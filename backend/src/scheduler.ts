import { pool } from './db';
import { emailQueue, jobIdFor, jobOptions } from './queue';
import { indexEmails } from './elastic';
import { config } from './config';

export interface ScheduleInput {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO
  delaySeconds: number;
  hourlyLimit?: number;
}

/**
 * Email i is scheduled at start + i * delay. Senders are assigned round-robin.
 * Each email = 1 DB row (source of truth) + 1 BullMQ delayed job (jobId = email-<id>).
 */
export async function scheduleBatch(userId: number, input: ScheduleInput) {
  const { rows: senders } = await pool.query('SELECT id FROM senders ORDER BY id');
  if (!senders.length) throw new Error('No senders configured');

  const start = Math.max(new Date(input.startTime).getTime(), Date.now());
  const delayMs = Math.max(0, input.delaySeconds) * 1000;
  const hourlyLimit = input.hourlyLimit ?? config.maxEmailsPerHourPerSender;

  const client = await pool.connect();
  const created: any[] = [];
  try {
    await client.query('BEGIN');
    for (let i = 0; i < input.recipients.length; i++) {
      const at = new Date(start + i * delayMs);
      const sender = senders[i % senders.length];
      const { rows } = await client.query(
        `INSERT INTO emails (user_id, sender_id, to_email, subject, body, scheduled_at, hourly_limit)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [userId, sender.id, input.recipients[i], input.subject, input.body, at, hourlyLimit]
      );
      created.push(rows[0]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await emailQueue.addBulk(
    created.map((e) => ({
      name: 'send',
      data: { emailId: e.id, userId },
      opts: jobOptions(e.id, e.scheduled_at),
    }))
  );
  await indexEmails(created);
  return created.length;
}

/** On boot: re-create any job that exists in the DB as 'scheduled' but is missing from Redis (e.g. Redis was wiped). */
export async function recoverMissingJobs() {
  const { rows } = await pool.query(`SELECT id, user_id, scheduled_at FROM emails WHERE status='scheduled'`);
  let restored = 0;
  for (const r of rows) {
    const existing = await emailQueue.getJob(jobIdFor(r.id));
    if (!existing) {
      await emailQueue.add('send', { emailId: r.id, userId: r.user_id }, jobOptions(r.id, r.scheduled_at));
      restored++;
    }
  }
  if (restored) console.log(`[recovery] re-enqueued ${restored} missing jobs`);
}
