import { Router } from 'express';
import { pool } from '../db';
import { AuthedRequest, requireAuth } from '../auth';
import { scheduleBatch } from '../scheduler';
import { searchEmails } from '../elastic';
import { config } from '../config';

const router = Router();
router.use(requireAuth);

const STATUS_GROUPS: Record<string, string[]> = {
  scheduled: ['scheduled', 'processing'],
  sent: ['sent', 'failed'],
};

router.post('/schedule', async (req: AuthedRequest, res) => {
  const { subject, body, recipients, startTime, delaySeconds, hourlyLimit } = req.body ?? {};
  if (!subject || !body || !Array.isArray(recipients) || !recipients.length || !startTime)
    return res.status(400).json({ error: 'subject, body, recipients[] and startTime are required' });
  if (Number.isNaN(new Date(startTime).getTime())) return res.status(400).json({ error: 'Invalid startTime' });

  const clean = [...new Set<string>(recipients.map((r: string) => String(r).trim().toLowerCase()))].filter((r) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)
  );
  if (!clean.length) return res.status(400).json({ error: 'No valid email addresses' });

  try {
    const count = await scheduleBatch(req.userId!, {
      subject, body, recipients: clean, startTime,
      delaySeconds: Number(delaySeconds ?? 0),
      hourlyLimit: hourlyLimit ? Number(hourlyLimit) : config.maxEmailsPerHourPerSender,
    });
    res.status(201).json({ scheduled: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/', async (req: AuthedRequest, res) => {
  const statuses = STATUS_GROUPS[String(req.query.status)] ?? STATUS_GROUPS.scheduled;
  const order = statuses.includes('sent') ? 'COALESCE(sent_at, updated_at) DESC' : 'scheduled_at ASC';
  const { rows } = await pool.query(
    `SELECT id, to_email, subject, scheduled_at, sent_at, status, preview_url, error
       FROM emails WHERE user_id=$1 AND status = ANY($2) ORDER BY ${order} LIMIT 500`,
    [req.userId, statuses]
  );
  res.json(rows);
});

// Elasticsearch-powered search
router.get('/search', async (req: AuthedRequest, res) => {
  const statuses = STATUS_GROUPS[String(req.query.status)];
  try {
    res.json(await searchEmails(req.userId!, String(req.query.q ?? ''), statuses));
  } catch (e) {
    res.status(503).json({ error: 'Search unavailable: ' + (e as Error).message });
  }
});

export default router;
