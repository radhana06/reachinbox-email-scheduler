import { useEffect, useState } from 'react';
import { api, slackConnectUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button } from '../ui/Button';
import type { SlackStatus } from '../types';

export function SlackButton() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.slackStatus().then(setStatus).catch(() => setStatus({ connected: false, team: null, channel: null }));
    const flag = new URLSearchParams(window.location.search).get('slack');
    if (flag === 'connected') toast('Slack connected!');
    if (flag === 'error') toast('Slack connection failed', 'error');
  }, [toast]);

  if (!status) return null;
  if (!status.connected)
    return <Button variant="outline" onClick={() => (window.location.href = slackConnectUrl)}>Connect Slack</Button>;

  return (
    <Button
      variant="ghost"
      title="Click to disconnect"
      onClick={async () => {
        await api.slackDisconnect();
        setStatus({ connected: false, team: null, channel: null });
        toast('Slack disconnected');
      }}
    >
      ✅ Slack{status.channel ? ` ${status.channel}` : ''}
    </Button>
  );
}
