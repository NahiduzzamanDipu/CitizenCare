import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, CardHeader, Badge, Spinner, Alert, EmptyState } from '../ui/Card';
import { Button, TextInput, Select } from '../ui/Field';

const ACTION_TONE = {
  'user.delete': 'red',
  'user.deactivate': 'red',
  'station.delete': 'red',
  'station.rotateCode': 'amber',
  'user.resetPassword': 'amber',
  'station.create': 'green',
  broadcast: 'violet',
};

export function AdminAudit() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.get('/api/admin/audit?limit=200'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Every privileged action, newest first.
        </p>
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="green">{notice}</Alert>}

      <BroadcastPanel onSent={(msg) => setNotice(msg)} onError={setError} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing logged yet">
          Actions like role changes, code rotations and deletions will show up
          here.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e._id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-900 dark:text-white">
                        {e.actorName || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">{e.actorRole}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ACTION_TONE[e.action] || 'slate'}>{e.action}</Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {e.detail || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function BroadcastPanel({ onSent, onError }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);

  async function send(e) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/api/admin/broadcast', { title, body, audience });
      onSent(`Notice delivered to ${res.sent} account${res.sent === 1 ? '' : 's'}.`);
      setTitle('');
      setBody('');
    } catch (err) {
      onError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Broadcast a notice"
        subtitle="Delivered as an in-app notification and a live toast."
      />
      <form onSubmit={send} className="grid gap-3 px-5 pb-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextInput
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Scheduled maintenance tonight"
        />
        <TextInput
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional detail"
        />
        <div className="flex gap-2">
          <Select
            label="To"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-32"
          >
            <option value="all">Everyone</option>
            <option value="citizen">Citizens</option>
            <option value="police">Police</option>
          </Select>
          <Button type="submit" loading={sending} disabled={!title.trim()} className="self-end">
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
