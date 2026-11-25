import { migrate, pool } from './db';
import { ensureIndex } from './elastic';
import { createEtherealSender } from './mailer';
import { recoverMissingJobs } from './scheduler';
import { config } from './config';

export async function bootstrap() {
  await migrate();
  try { await ensureIndex(); } catch (e) { console.warn('[ES] not ready:', (e as Error).message); }

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM senders');
  for (let i = rows[0].n; i < config.senderCount; i++) {
    const s = await createEtherealSender();
    await pool.query(
      'INSERT INTO senders (email, smtp_host, smtp_port, smtp_user, smtp_pass) VALUES ($1,$2,$3,$4,$5)',
      [s.email, s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_pass]
    );
    console.log(`[senders] created Ethereal sender ${s.email}`);
  }
  await recoverMissingJobs();
}
