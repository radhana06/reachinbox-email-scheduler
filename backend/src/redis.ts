import IORedis from 'ioredis';
import { config } from './config';

const u = new URL(config.redisUrl);
const useTls = u.protocol === 'rediss:';

// General-purpose client (rate-limit counters, notification dedupe keys)
export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

// BullMQ wants plain connection options (and maxRetriesPerRequest: null for workers).
// Supports hosted Redis: username/password + TLS (rediss://).
export const bullConnection = {
  host: u.hostname,
  port: Number(u.port || 6379),
  username: u.username ? decodeURIComponent(u.username) : undefined,
  password: u.password ? decodeURIComponent(u.password) : undefined,
  tls: useTls ? {} : undefined,
  maxRetriesPerRequest: null as null,
};
