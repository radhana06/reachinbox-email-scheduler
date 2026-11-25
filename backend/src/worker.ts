import { DelayedError, Job, Worker } from 'bullmq';
import { config } from './config';
import { pool } from './db';
import { redis, bullConnection } from './redis';
import { EmailJobData, QUEUE_NAME } from './queue';
import { sendMail } from './mailer';
import { notifyRateLimit } from './slack';
import { updateEmailDoc } from './elastic';
import { bootstrap } from './bootstrap';

const HOUR = 3_600_000;

async function processor(job: Job<EmailJobData>, token?: string) {
  const { emailId, userId } = job.data;
  const { rows } = await pool.query(
    `SELECT e.*, s.email AS from_email, s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_pass
       FROM emails e JOIN senders s ON s.id = e.sender_id WHERE e.id = $1`,
    [emailId]
  );
  const row = rows[0];
  if (!row || row.status === 'sent' || row.status === 'failed') return; // idempotent: already handled

  // ---- 1. Hourly rate limit: Redis counter keyed by sender + hour window. INCR is atomic => safe across workers/instances
  const windowId = Math.floor(Date.now() / HOUR);
  const key = `rate:${row.sender_id}:${windowId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 2 * 3600);
  const limit = row.hourly_limit ?? config.maxEmailsPerHourPerSender;

  if (count > limit) {
    await redis.decr(key);
    // Push to start of next hour window; + (id % 1000) ms keeps the original ordering among rescheduled jobs
    const next = (windowId + 1) * HOUR + (emailId % 1000);
    await pool.query('UPDATE emails SET scheduled_at=$2, updated_at=now() WHERE id=$1', [emailId, new Date(next)]);
    await notifyRateLimit(userId, row.from_email, limit, windowId, new Date(next));
    await job.moveToDelayed(next, token); // NOT dropped, NOT failed: just delayed
    throw new DelayedError();
  }

  // ---- 2. Atomic claim: prevents duplicate sends if the same job is ever picked up twice
  const claim = await pool.query(
    `UPDATE emails SET status='processing', updated_at=now()
      WHERE id=$1 AND (status='scheduled' OR (status='processing' AND updated_at < now() - interval '2 minutes'))
      RETURNING id`,
    [emailId]
  );
  if (!claim.rowCount) {
    await redis.decr(key);
    const cur = await pool.query('SELECT status FROM emails WHERE id=$1', [emailId]);
    if (cur.rows[0]?.status === 'processing') {
      await job.moveToDelayed(Date.now() + 30_000, token); // another worker is sending it; check again later
      throw new DelayedError();
    }
    return;
  }

  // ---- 3. Send via Ethereal SMTP
  try {
    const { previewUrl } = await sendMail(
      { id: row.sender_id, email: row.from_email, smtp_host: row.smtp_host, smtp_port: row.smtp_port, smtp_user: row.smtp_user, smtp_pass: row.smtp_pass },
      row.to_email, row.subject, row.body
    );
    const sentAt = new Date();
    await pool.query(`UPDATE emails SET status='sent', sent_at=$2, preview_url=$3, error=NULL, updated_at=now() WHERE id=$1`, [emailId, sentAt, previewUrl]);
    await updateEmailDoc(emailId, { status: 'sent', sent_at: sentAt, preview_url: previewUrl });
    console.log(`[worker] sent #${emailId} -> ${row.to_email} via ${row.from_email}`);
  } catch (err) {
    const isFinal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const status = isFinal ? 'failed' : 'scheduled';
    await pool.query(`UPDATE emails SET status=$2, error=$3, updated_at=now() WHERE id=$1`, [emailId, status, (err as Error).message]);
    await updateEmailDoc(emailId, { status });
    throw err; // BullMQ retries with exponential backoff
  }
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, processor, {
    connection: bullConnection,
    concurrency: config.workerConcurrency,
    // Global throttle: at most 1 job START per MIN_DELAY_MS across ALL workers (mimics provider throttling)
    limiter: { max: 1, duration: config.minDelayMs },
  });
  worker.on('failed', (job, err) => console.warn(`[worker] job ${job?.id} failed: ${err.message}`));
  console.log(`[worker] started (concurrency=${config.workerConcurrency}, minDelay=${config.minDelayMs}ms)`);
  return worker;
}

// Standalone mode:  npm run worker
if (require.main === module) {
  bootstrap().then(startWorker).catch((e) => { console.error(e); process.exit(1); });
}
