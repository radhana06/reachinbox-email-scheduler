import { Router } from 'express';
import { pool } from '../db';
import { AuthedRequest, requireAuth } from '../auth';

const router = Router();
router.use(requireAuth);

router.get('/status', async (req: AuthedRequest, res) => {
  const { rows } = await pool.query('SELECT team_name, channel FROM slack_connections WHERE user_id=$1', [req.userId]);
  res.json({ connected: !!rows[0], team: rows[0]?.team_name ?? null, channel: rows[0]?.channel ?? null });
});

router.delete('/', async (req: AuthedRequest, res) => {
  await pool.query('DELETE FROM slack_connections WHERE user_id=$1', [req.userId]);
  res.json({ ok: true });
});

export default router;
