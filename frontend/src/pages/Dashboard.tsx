import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { EmailRow } from '../types';
import { Header } from '../components/Header';
import { EmailTable } from '../components/EmailTable';
import { ComposeModal } from '../components/ComposeModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Tab = 'scheduled' | 'sent';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('scheduled');
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      setRows(query.trim() ? await api.searchEmails(query.trim(), tab) : await api.listEmails(tab));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, query]);

  useEffect(() => {
    const t = setTimeout(() => load(), query ? 300 : 0); // debounce search
    return () => clearTimeout(t);
  }, [load, query]);

  useEffect(() => {
    const t = setInterval(() => load(false), 10_000); // live-ish refresh
    return () => clearInterval(t);
  }, [load]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg bg-gray-200 p-1">
            {(['scheduled', 'sent'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                {t} Emails
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Input placeholder="Search (Elasticsearch)…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-56" />
            <Button onClick={() => setComposeOpen(true)}>+ Compose New Email</Button>
          </div>
        </div>

        <EmailTable rows={rows} loading={loading} variant={tab} error={error} />
      </main>
      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onScheduled={() => { setTab('scheduled'); load(); }} />
    </div>
  );
}
