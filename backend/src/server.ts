import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { bootstrap } from './bootstrap';
import { emailQueue } from './queue';
import { startWorker } from './worker';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import slackRoutes from './routes/slack';

async function main() {
  await bootstrap();

  const app = express();
  app.set('trust proxy', 1); // behind Render/Railway proxy (needed for secure cookies)
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  // Live BullMQ dashboard -> http://localhost:4000/admin/queues
  const board = new ExpressAdapter();
  board.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: board });
  app.use('/admin/queues', board.getRouter());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);

  // Serve the built React dashboard from the same origin (one URL, no CORS/cookie issues)
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(config.port, () => console.log(`API on ${config.backendUrl}  |  Bull board: ${config.backendUrl}/admin/queues`));
  if (config.runWorker) startWorker();
}

main().catch((e) => { console.error(e); process.exit(1); });
