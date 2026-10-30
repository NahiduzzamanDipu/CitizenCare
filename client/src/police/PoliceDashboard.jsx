import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, Stat, Badge, EmptyState } from '../ui/Card';
import { Button } from '../ui/Field';
import { api, mediaUrl } from '../api/client';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const ONLINE_MS = 8000;
const VISIBLE_MS = 30000;
const POLL_MS = 4000;

function lastSeenMs(cam) {
  if (Number.isFinite(cam?.lastSeen)) return cam.lastSeen;
  const t = cam?.createdAt ? Date.parse(cam.createdAt) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Cache-busts a snapshot URL so the browser shows the newest frame. */
function freshUrl(url) {
  const base = mediaUrl(url || '');
  if (!base) return '';
  return `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`;
}

export function PoliceDashboard() {
  const { connected } = useSocket();
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cams, setCams] = useState({});
  // Re-render on a timer so "LIVE / OFFLINE" ages correctly without new events.
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.get('/api/analytics/summary'),
      api.get('/api/cctv/events?limit=12'),
    ]).then(([summaryRes, eventsRes]) => {
      if (cancelled) return;
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      if (eventsRes.status === 'fulfilled') {
        setAlerts(
          (eventsRes.value || []).map((e) => ({
            id: e._id,
            title: 'Weapon / suspicious object',
            when: e.createdAt,
            level: 'High',
            who: e.user?.name || 'Unknown',
            place: e.place || e.cameraId,
            labels: e.labels || [],
          }))
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mergeStatus = useCallback((items) => {
    setCams((prev) => {
      const next = { ...prev };
      for (const p of items) {
        if (!p?.cameraId) continue;
        const existing = next[p.cameraId];
        // A socket preview frame (data: URL) is fresher than a disk snapshot.
        const keepPreview = existing?.imageUrl?.startsWith('data:image/');
        next[p.cameraId] = {
          ...(existing || {}),
          ...p,
          imageUrl: keepPreview
            ? existing.imageUrl
            : freshUrl(p.imageUrl) || existing?.imageUrl || '',
          lastSeen: Number.isFinite(p.lastSeen) ? p.lastSeen : Date.now(),
        };
      }
      return next;
    });
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const r = await api.get('/api/cctv/status');
      mergeStatus(Array.isArray(r?.items) ? r.items : []);
    } catch {
      // Transient failures are fine — the next poll or socket event recovers.
    }
  }, [mergeStatus]);

  useEffect(() => {
    pollStatus();
    const t = setInterval(pollStatus, POLL_MS);
    return () => clearInterval(t);
  }, [pollStatus]);

  useSocketEvent('cctv-status', (p) => mergeStatus([p]));

  useSocketEvent('cctv-frame', (p) => {
    if (!p?.cameraId || !p?.imageData) return;
    setCams((prev) => ({
      ...prev,
      [p.cameraId]: {
        ...(prev[p.cameraId] || {}),
        ...p,
        imageUrl: `data:image/jpeg;base64,${p.imageData}`,
        lastSeen: Date.now(),
      },
    }));
  });

  useSocketEvent('cctv-alert', (p) => {
    setAlerts((prev) =>
      [
        {
          id: p.eventId || `live-${Date.now()}`,
          title: p.title || 'Weapon / suspicious object',
          when: p.createdAt || new Date().toISOString(),
          level: 'High',
          who: p.userName || 'Unknown',
          place: p.place || p.cameraId,
          labels: p.labels || [],
        },
        ...prev.filter((a) => a.id !== p.eventId),
      ].slice(0, 12)
    );
    if (p?.cameraId) mergeStatus([p]);
  });

  const visibleCams = useMemo(
    () =>
      Object.values(cams)
        .filter((c) => Date.now() - lastSeenMs(c) < VISIBLE_MS)
        .sort((a, b) => lastSeenMs(b) - lastSeenMs(a)),
    // Re-derived on every tick so stale cameras drop off.
    [cams]
  );

  const onlineCount = visibleCams.filter(
    (c) => Date.now() - lastSeenMs(c) < ONLINE_MS
  ).length;

  return (
    <div className="space-y-6">
      <TopBar connected={connected} user={user} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Pending incidents"
          value={summary?.pendingReports ?? '—'}
          tone={summary?.pendingReports > 0 ? 'warn' : undefined}
          hint="Awaiting verification"
        />
        <Stat
          label="Verified incidents"
          value={summary?.approvedReports ?? '—'}
          hint="Published to the public map"
        />
        <Stat
          label="Active SOS"
          value={summary?.activeAlerts ?? '—'}
          tone={summary?.activeAlerts > 0 ? 'danger' : undefined}
          hint={`${summary?.totalAlerts ?? 0} all time`}
        />
        <Stat
          label="Cameras online"
          value={onlineCount}
          hint="Streaming right now"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Live surveillance"
            subtitle="AI overlays flag a red border when a weapon is detected"
            right={
              <Link to="/police/live-feeds">
                <Button className="px-4 py-2 text-sm">Open camera</Button>
              </Link>
            }
          />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleCams.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3">
                <EmptyState
                  title="No cameras connected"
                  action={
                    <Link to="/police/live-feeds">
                      <Button>Start a camera</Button>
                    </Link>
                  }
                >
                  Open <strong>Live feeds</strong> on this machine or a phone to
                  start streaming. Frames are analysed once per second.
                </EmptyState>
              </div>
            ) : (
              visibleCams.map((live) => (
                <CctvCard
                  key={live.cameraId}
                  cam={live.cameraId}
                  place={live.place || 'Unknown location'}
                  threat={Boolean(live.weaponDetected)}
                  online={Date.now() - lastSeenMs(live) < ONLINE_MS}
                  imageUrl={live.imageUrl || ''}
                  labels={live.labels || []}
                />
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Latest detections"
            subtitle="Weapon alerts from live CCTV"
            right={<Badge tone={alerts.length ? 'red' : 'slate'}>{alerts.length}</Badge>}
          />
          <div className="space-y-3 px-5 pb-5">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">
                No weapon detections recorded.
              </p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {a.title}
                    </p>
                    <Badge tone="red">{a.level}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {a.place ? `${a.place} · ` : ''}
                    {a.who} · {new Date(a.when).toLocaleString()}
                  </p>
                  {a.labels.length > 0 && (
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {a.labels.join(', ')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TopBar({ connected, user }) {
  const now = new Date();
  const initials = (user?.name || 'PS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Command dashboard
        </p>
        <p className="text-xs text-slate-500">
          {now.toLocaleDateString(undefined, {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
          })}{' '}
          · {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={
            connected
              ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }
        >
          {connected ? 'CONNECTED' : 'CONNECTING'}
        </span>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              {user?.name || 'Police staff'}
            </p>
            <p className="text-[10px] text-slate-500">{user?.email || '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CctvCard({ cam, place, threat, online, imageUrl, labels }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-slate-950 transition ${
        threat
          ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
          : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-bold tracking-wide text-slate-300">{cam}</span>
        <span
          className={`flex items-center gap-1.5 text-[10px] font-semibold ${
            online ? 'text-emerald-400' : 'text-slate-500'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              online ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'
            }`}
          />
          {online ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-950">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Feed from ${cam}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-600">
            Waiting for frames…
          </div>
        )}
        {threat && (
          <>
            <div className="absolute inset-0 ring-2 ring-inset ring-red-500/70" />
            <div className="absolute bottom-3 left-3 rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
              {labels.length ? labels.join(', ').toUpperCase() : 'WEAPON DETECTED'}
            </div>
          </>
        )}
      </div>

      <div className="px-3 py-3">
        <p className="truncate text-xs font-semibold text-slate-200">{place}</p>
      </div>
    </div>
  );
}
