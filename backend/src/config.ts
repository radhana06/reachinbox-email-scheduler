import 'dotenv/config';

const num = (key: string, fallback: number) => Number(process.env[key] ?? fallback);
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';

export const config = {
  port: num('PORT', 4000),
  backendUrl,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/scheduler',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  elasticUrl: process.env.ELASTIC_URL ?? 'http://localhost:9200',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: `${backendUrl}/auth/google/callback`,
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID ?? '',
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
    redirectUri: `${backendUrl}/auth/slack/callback`,
  },
  workerConcurrency: num('WORKER_CONCURRENCY', 5),
  minDelayMs: num('MIN_DELAY_MS', 2000),
  maxEmailsPerHourPerSender: num('MAX_EMAILS_PER_HOUR_PER_SENDER', 50),
  senderCount: num('SENDER_COUNT', 3),
  runWorker: process.env.RUN_WORKER !== 'false',
};
