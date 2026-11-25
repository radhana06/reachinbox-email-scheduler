import { pool } from './db';
import { redis } from './redis';

/** Sends a real Slack message when a sender hits its hourly cap. Silent no-op if the user hasn't connected Slack. */
export async function notifyRateLimit(userId: number, senderEmail: string, limit: number, windowId: number, resumeAt: Date) {
  const { rows } = await pool.query('SELECT webhook_url FROM slack_connections WHERE user_id=$1', [userId]);
  if (!rows[0]) return; // not connected -> nothing to do, no crash

  // Only one notification per sender per hour window (SET NX = atomic across workers)
  const first = await redis.set(`slack-notified:${userId}:${senderEmail}:${windowId}`, '1', 'EX', 7200, 'NX');
  if (!first) return;

  try {
    const res = await fetch(rows[0].webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:warning: *Hourly limit reached* for sender \`${senderEmail}\` (${limit}/hour). Remaining emails are rescheduled to ${resumeAt.toISOString()}.`,
      }),
    });
    if (!res.ok) console.warn('[Slack] webhook responded', res.status, await res.text());
    else console.log('[Slack] rate-limit notification sent');
  } catch (e) {
    console.warn('[Slack] failed to notify:', (e as Error).message);
  }
}
