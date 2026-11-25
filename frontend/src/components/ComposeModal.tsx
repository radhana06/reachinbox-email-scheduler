import { useMemo, useState, type ChangeEvent } from 'react';
import { api } from '../lib/api';
import { extractEmails, toLocalInput } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Input';

interface Props { open: boolean; onClose: () => void; onScheduled: () => void }

export function ComposeModal({ open, onClose, onScheduled }: Props) {
  const toast = useToast();
  const defaultStart = useMemo(() => toLocalInput(new Date(Date.now() + 2 * 60_000)), [open]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [start, setStart] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRecipients(extractEmails(await file.text()));
  }

  async function submit() {
    if (!subject.trim() || !body.trim()) return toast('Subject and body are required', 'error');
    if (!recipients.length) return toast('Upload a CSV/text file containing email addresses', 'error');
    setBusy(true);
    try {
      const res = await api.schedule({
        subject, body, recipients,
        startTime: new Date(start || defaultStart).toISOString(),
        delaySeconds, hourlyLimit,
      });
      toast(`Scheduled ${res.scheduled} emails`);
      setSubject(''); setBody(''); setRecipients([]); setFileName('');
      onScheduled();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Compose New Email">
      <div className="space-y-4">
        <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about…" /></Field>
        <Field label="Body"><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi there, …" /></Field>

        <Field label="Leads (CSV or text file)">
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-green-700" />
          {fileName && <p className="mt-1 text-sm text-gray-600">{fileName} — <b>{recipients.length}</b> email address{recipients.length === 1 ? '' : 'es'} detected</p>}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Start time"><Input type="datetime-local" value={start || defaultStart} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Delay between emails (sec)"><Input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value))} /></Field>
          <Field label="Hourly limit (per sender)"><Input type="number" min={1} value={hourlyLimit} onChange={(e) => setHourlyLimit(Number(e.target.value))} /></Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Schedule</Button>
        </div>
      </div>
    </Modal>
  );
}
