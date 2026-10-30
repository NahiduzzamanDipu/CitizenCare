import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const TOAST_MS = 6000;
const MAX_TOASTS = 3;

const TONES = {
  emergency: 'border-red-300 bg-red-600 text-white dark:border-red-700',
  report: 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white',
  system: 'border-brand-200 bg-white text-slate-900 dark:border-brand-800 dark:bg-slate-900 dark:text-white',
};

/** Stacked toasts for realtime notifications. */
export function NotificationHost() {
  const { user } = useAuth();
  const { lastEvent } = useSocket();
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!lastEvent || !user) return;
    // Citizens have no use for the staff-wide emergency feed.
    if (user.role === 'citizen' && lastEvent.type === 'emergency') return;
    if (lastEvent.type === 'emergency-updated') return;
    if (lastEvent.type === 'public-safety') return;

    const { payload } = lastEvent;
    const toast = {
      id: `${lastEvent.at}-${Math.random().toString(36).slice(2, 7)}`,
      title: payload?.title || 'Notification',
      body: payload?.body || payload?.message || '',
      tone: payload?.type === 'emergency' ? 'emergency' : payload?.type || 'system',
    };

    setToasts((prev) => [toast, ...prev].slice(0, MAX_TOASTS));
    const t = setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== toast.id)),
      TOAST_MS
    );
    return () => clearTimeout(t);
  }, [lastEvent, user]);

  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-xl border p-4 shadow-lg ${TONES[t.tone] || TONES.system}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-1 text-sm opacity-90">{t.body}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-lg leading-none opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
