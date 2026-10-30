import { useEffect, useState } from 'react';
import { Card, CardHeader, Badge, Alert } from '../ui/Card';
import { Button, TextInput } from '../ui/Field';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { hasGoogleMapsKey } from '../maps/useGoogleMaps';

export function PoliceSettings() {
  const { theme, toggle } = useTheme();
  const { user, updateProfile } = useAuth();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your profile, appearance and the status of connected services.
        </p>
      </header>

      <ProfileCard user={user} onSave={updateProfile} />
      <PasswordCard />

      <Card>
        <CardHeader title="Appearance" subtitle="Applies to this browser only." />
        <div className="px-5 pb-5">
          <Button variant="ghost" onClick={toggle}>
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </Button>
        </div>
      </Card>

      <ServiceStatus />
    </div>
  );
}

function ProfileCard({ user, onSave }) {
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await onSave(form);
      setStatus({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Your profile" />
      <form onSubmit={submit} className="space-y-4 px-5 pb-5">
        {status && (
          <Alert tone={status.type === 'ok' ? 'green' : 'red'}>{status.text}</Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <dl className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950 sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-800 dark:text-slate-200">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Badge</dt>
            <dd className="text-slate-800 dark:text-slate-200">{user?.badgeId || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Station</dt>
            <dd className="text-slate-800 dark:text-slate-200">
              {user?.station?.name || 'Unassigned'}
            </dd>
          </div>
        </dl>
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setStatus({ type: 'ok', text: 'Password changed.' });
      setCurrent('');
      setNew('');
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Change password" />
      <form onSubmit={submit} className="space-y-4 px-5 pb-5">
        {status && (
          <Alert tone={status.type === 'ok' ? 'green' : 'red'}>{status.text}</Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextInput
            label="New password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </div>
        <Button type="submit" loading={saving} disabled={newPassword.length < 8}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

/** Live check of the two optional services this deployment depends on. */
function ServiceStatus() {
  const [ai, setAi] = useState({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/cctv/ai-health')
      .then((d) => !cancelled && setAi({ state: 'ok', data: d }))
      .catch((e) => !cancelled && setAi({ state: 'down', message: e.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader
        title="Connected services"
        subtitle="Optional integrations — the app runs without them, with reduced features."
      />
      <div className="space-y-3 px-5 pb-5">
        <ServiceRow
          name="Google Maps"
          ok={hasGoogleMapsKey()}
          okText="Configured"
          downText="Missing VITE_GOOGLE_MAPS_API_KEY — maps fall back to tables."
        />
        <ServiceRow
          name="Python AI (YOLOv8)"
          ok={ai.state === 'ok'}
          pending={ai.state === 'checking'}
          okText={
            ai.data?.model
              ? `Running model ${ai.data.model}`
              : 'Reachable'
          }
          downText={
            ai.message ||
            'Unreachable — start ai-model/app.py and set PYTHON_AI_URL in server/.env.'
          }
        />
      </div>
    </Card>
  );
}

function ServiceRow({ name, ok, pending, okText, downText }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{name}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {pending ? 'Checking…' : ok ? okText : downText}
        </p>
      </div>
      <Badge tone={pending ? 'slate' : ok ? 'green' : 'amber'}>
        {pending ? 'Checking' : ok ? 'Online' : 'Unavailable'}
      </Badge>
    </div>
  );
}
