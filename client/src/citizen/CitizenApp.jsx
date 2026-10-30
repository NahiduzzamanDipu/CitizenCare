import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import { CitizenMap } from './CitizenMap';
import { ReportCrime } from '../pages/ReportCrime';
import { Badge, Spinner, EmptyState, Alert } from '../ui/Card';
import { Button, TextInput } from '../ui/Field';

const tabs = [
  { to: '/app', label: 'Safety', end: true },
  { to: '/app/reports', label: 'My reports' },
  { to: '/app/alerts', label: 'Alerts' },
  { to: '/app/profile', label: 'Profile' },
];

function tabClass({ isActive }) {
  return `rounded-2xl px-2 py-2 text-center text-xs font-semibold transition ${
    isActive
      ? 'bg-brand-600 text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;
}

export function CitizenAppShell() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-950 dark:shadow-card-dark">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <ShieldMini />
            </div>
            <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
              CitizenCare
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <span className="max-w-[80px] truncate text-xs text-slate-400">
              {user?.name || ''}
            </span>
          </div>
        </div>

        <div className="px-6 pb-32">
          <Outlet />
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent px-6 pb-5 pt-8 dark:from-slate-950 dark:via-slate-950/95">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-2 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div className="grid grid-cols-4 gap-1">
              {tabs.map((t) => (
                <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
                  {t.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to="/emergency"
          className="rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700"
        >
          Send SOS
        </Link>
        <a
          href="tel:999"
          className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-center text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:hover:bg-red-950/40"
        >
          Call 999
        </a>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- safety */

export function CitizenSafetyHome() {
  return (
    <div className="space-y-5">
      <CitizenMap />

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/map"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Full map
        </Link>
        <Link
          to="/app/report"
          className="rounded-2xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Report incident
        </Link>
      </div>

      <RecentActivity />
    </div>
  );
}

/** Verified incidents near the citizen — real data, newest first. */
function RecentActivity() {
  const [items, setItems] = useState(null);

  const load = useCallback(async () => {
    try {
      const [reports, cctv] = await Promise.all([
        api.get('/api/reports/map?limit=8'),
        api.get('/api/cctv/public-map?limit=8'),
      ]);
      const merged = [
        ...(reports || []).map((r) => ({
          id: `r-${r._id}`,
          tone: 'danger',
          location: r.location?.address || r.crimeType,
          result: r.crimeType?.toUpperCase() || 'INCIDENT',
          message: r.title,
          when: r.createdAt,
        })),
        ...(cctv || []).map((e) => ({
          id: `c-${e._id}`,
          tone: 'danger',
          location: e.place || e.cameraId || 'CCTV camera',
          result: 'WEAPON',
          message: `Detected: ${(e.labels || []).join(', ') || 'suspicious object'}`,
          when: e.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.when) - new Date(a.when))
        .slice(0, 6);
      setItems(merged);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('public-safety', load);

  return (
    <div>
      <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
        Recent activity
      </p>
      <div className="mt-3 space-y-3">
        {items === null ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              All quiet
            </p>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
              No verified incidents have been published yet.
            </p>
          </div>
        ) : (
          items.map((a) => <ActivityRow key={a.id} {...a} />)
        )}
      </div>
    </div>
  );
}

function ActivityRow({ tone, location, result, message, when }) {
  const bar = tone === 'danger' ? 'bg-red-500' : 'bg-emerald-500';
  const badge =
    tone === 'danger'
      ? 'bg-red-600/15 text-red-700 dark:bg-red-500/15 dark:text-red-200'
      : 'bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';

  return (
    <div className="flex items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 h-10 w-1.5 shrink-0 rounded-full ${bar}`} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {location}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge}`}>
              {result}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
            {message}
          </p>
        </div>
      </div>
      <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
        {relativeTime(when)}
      </span>
    </div>
  );
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/* ---------------------------------------------------------------- reports */

export function CitizenReports() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api
      .get('/api/reports/mine')
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const tone = {
    pending: 'amber',
    verified: 'green',
    fake: 'red',
    resolved: 'brand',
  };

  return (
    <div className="space-y-3">
      <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
        My reports
      </p>

      {items === null ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No reports yet"
          action={
            <Link to="/app/report">
              <Button>File your first report</Button>
            </Link>
          }
        >
          Anything you submit will show up here with its review status.
        </EmptyState>
      ) : (
        items.map((r) => (
          <div
            key={r._id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {r.title}
              </p>
              <Badge tone={tone[r.status]}>{r.status}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
              {r.description}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {r.crimeType} · {new Date(r.createdAt).toLocaleString()}
            </p>
            {r.note && (
              <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                Officer note: {r.note}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- alerts */

export function CitizenAlerts() {
  const [items, setItems] = useState(null);

  const load = useCallback(() => {
    api
      .get('/api/notifications?limit=50')
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('notification', load);

  async function markAllRead() {
    await api.post('/api/notifications/read-all');
    load();
  }

  const unread = (items || []).filter((n) => !n.read).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Alerts
        </p>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Mark all read ({unread})
          </button>
        )}
      </div>

      {items === null ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No alerts yet">
          Updates about your reports, SOS alerts and public safety notices land
          here.
        </EmptyState>
      ) : (
        items.map((n) => (
          <div
            key={n._id}
            className={`rounded-2xl border p-4 ${
              n.read
                ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                : 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30'
            }`}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {n.title}
            </p>
            {n.body && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {n.body}
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- profile */

export function CitizenProfile() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateProfile(form);
      setStatus({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
        Profile
      </p>

      <form
        onSubmit={save}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        {status && (
          <Alert tone={status.type === 'ok' ? 'green' : 'red'}>{status.text}</Alert>
        )}
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
          hint="Shared with responders when you send an SOS."
        />
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <p>
            <strong>Email:</strong> {user?.email}
          </p>
          <p className="mt-0.5">
            <strong>Role:</strong> {user?.role}
          </p>
        </div>
        <Button type="submit" loading={saving} className="w-full">
          Save changes
        </Button>
      </form>

      <ChangePassword />

      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          logout();
          navigate('/');
        }}
      >
        Log out
      </Button>
    </div>
  );
}

function ChangePassword() {
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
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        Change password
      </p>
      {status && (
        <Alert tone={status.type === 'ok' ? 'green' : 'red'}>{status.text}</Alert>
      )}
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
      <Button
        type="submit"
        loading={saving}
        disabled={newPassword.length < 8}
        className="w-full"
      >
        Update password
      </Button>
    </form>
  );
}

/* ----------------------------------------------------------------- report */

export function CitizenReport() {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
        Report an incident
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Search for a place or drag the pin to set the exact location.
      </p>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <ReportCrime compact onSubmitted={() => setTimeout(() => navigate('/app/reports'), 1200)} />
      </div>
    </div>
  );
}

function ShieldMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 2l8 4v6c0 7-4.8 10.8-8 11.9C8.8 22.8 4 19 4 12V6l8-4z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
