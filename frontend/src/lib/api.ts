import type { EmailRow, ScheduleRequest, SlackStatus, User } from '../types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status });
  }
  return res.json();
}

export const api = {
  me: () => request<User>('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  listEmails: (status: 'scheduled' | 'sent') => request<EmailRow[]>(`/api/emails?status=${status}`),
  searchEmails: (q: string, status: 'scheduled' | 'sent') =>
    request<EmailRow[]>(`/api/emails/search?q=${encodeURIComponent(q)}&status=${status}`),
  schedule: (body: ScheduleRequest) =>
    request<{ scheduled: number }>('/api/emails/schedule', { method: 'POST', body: JSON.stringify(body) }),
  slackStatus: () => request<SlackStatus>('/api/slack/status'),
  slackDisconnect: () => request('/api/slack', { method: 'DELETE' }),
};

export const googleLoginUrl = `${API_URL}/auth/google`;
export const slackConnectUrl = `${API_URL}/auth/slack`;
