import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';
import { AuthedRequest, requireAuth, signToken } from '../auth';

const router = Router();
const google = new OAuth2Client(config.google.clientId, config.google.clientSecret, config.google.redirectUri);

// ---------- Google login ----------
router.get('/google', (_req, res) => {
  res.redirect(google.generateAuthUrl({ scope: ['openid', 'email', 'profile'], prompt: 'select_account' }));
});

router.get('/google/callback', async (req, res) => {
  try {
    const { tokens } = await google.getToken(String(req.query.code));
    const ticket = await google.verifyIdToken({ idToken: tokens.id_token!, audience: config.google.clientId });
    const p = ticket.getPayload()!;
    const { rows } = await pool.query(
      `INSERT INTO users (google_id, email, name, avatar) VALUES ($1,$2,$3,$4)
       ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, avatar=EXCLUDED.avatar
       RETURNING id`,
      [p.sub, p.email, p.name, p.picture]
    );
    res.cookie('token', signToken(rows[0].id), { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 7 * 24 * 3600 * 1000 });
    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (e) {
    console.error('Google login failed', e);
    res.redirect(`${config.frontendUrl}/?error=login_failed`);
  }
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query('SELECT id, email, name, avatar FROM users WHERE id=$1', [req.userId]);
  rows[0] ? res.json(rows[0]) : res.status(401).json({ error: 'User not found' });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ---------- Slack connect (OAuth v2, incoming-webhook scope) ----------
router.get('/slack', requireAuth, (req: AuthedRequest, res) => {
  const state = jwt.sign({ uid: req.userId }, config.jwtSecret, { expiresIn: '10m' });
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', config.slack.clientId);
  url.searchParams.set('scope', 'incoming-webhook');
  url.searchParams.set('redirect_uri', config.slack.redirectUri);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

router.get('/slack/callback', async (req, res) => {
  try {
    const { uid } = jwt.verify(String(req.query.state), config.jwtSecret) as { uid: number };
    const r = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code: String(req.query.code),
        redirect_uri: config.slack.redirectUri,
      }),
    });
    const data: any = await r.json();
    if (!data.ok) throw new Error(data.error);
    await pool.query(
      `INSERT INTO slack_connections (user_id, webhook_url, team_name, channel) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET webhook_url=EXCLUDED.webhook_url, team_name=EXCLUDED.team_name, channel=EXCLUDED.channel`,
      [uid, data.incoming_webhook.url, data.team?.name, data.incoming_webhook.channel]
    );
    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (e) {
    console.error('Slack connect failed', e);
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
  }
});

export default router;




