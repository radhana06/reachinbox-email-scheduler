import { Queue } from 'bullmq';
import { bullConnection } from './redis';

export const QUEUE_NAME = 'email-queue';

export interface EmailJobData {
  emailId: number;
  userId: number;
}

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, { connection: bullConnection });

// Deterministic job id => enqueueing the same email twice is a no-op (idempotent)
export const jobIdFor = (emailId: number) => `email-${emailId}`;

export const jobOptions = (emailId: number, runAt: Date) => ({
  jobId: jobIdFor(emailId),
  delay: Math.max(0, new Date(runAt).getTime() - Date.now()),
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 2000 },
  removeOnFail: { count: 2000 },
});
