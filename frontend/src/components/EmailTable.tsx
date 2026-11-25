import type { EmailRow } from '../types';
import { formatDate } from '../lib/utils';
import { Spinner } from '../ui/Button';

const badge: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

interface Props { rows: EmailRow[]; loading: boolean; variant: 'scheduled' | 'sent'; error?: string | null }

export function EmailTable({ rows, loading, variant, error }: Props) {
  if (loading) return <div className="flex justify-center py-16 text-green-700"><Spinner size={28} /></div>;
  if (error) return <div className="py-16 text-center text-red-600">{error}</div>;
  if (!rows.length)
    return (
      <div className="py-16 text-center text-gray-500">
        <div className="text-4xl">📭</div>
        <p className="mt-2">{variant === 'scheduled' ? 'No scheduled emails yet. Click “Compose New Email”.' : 'No emails have been sent yet.'}</p>
      </div>
    );

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">{variant === 'scheduled' ? 'Scheduled time' : 'Sent time'}</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">{r.to_email}</td>
              <td className="max-w-xs truncate px-4 py-3">{r.subject}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(variant === 'scheduled' ? r.scheduled_at : r.sent_at ?? r.scheduled_at)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge[r.status]}`} title={r.error ?? ''}>{r.status}</span>
                {r.preview_url && <a href={r.preview_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-600 underline">preview</a>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
