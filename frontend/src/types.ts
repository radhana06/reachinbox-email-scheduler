export interface User { id: number; email: string; name: string; avatar: string }

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface EmailRow {
  id: number;
  to_email: string;
  subject: string;
  scheduled_at: string;
  sent_at: string | null;
  status: EmailStatus;
  preview_url?: string | null;
  error?: string | null;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
}

export interface SlackStatus { connected: boolean; team: string | null; channel: string | null }
