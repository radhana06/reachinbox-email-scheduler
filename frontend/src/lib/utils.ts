const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Pulls every email address out of any CSV / text content, de-duplicated. */
export function extractEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
}

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** Value for <input type="datetime-local"> */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
