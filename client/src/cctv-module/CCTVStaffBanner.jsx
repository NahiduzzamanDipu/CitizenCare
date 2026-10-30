import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

/**
 * Shows a dashboard-wide popup for police when any stream reports a weapon.
 */
export function CCTVStaffBanner() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [alert, setAlert] = useState(null);

  const staff = user && user.role === 'police';

  useEffect(() => {
    if (!socket || !staff) return undefined;
    const onCctv = (payload) => {
      setAlert(payload);
    };
    socket.on('cctv-alert', onCctv);
    return () => {
      socket.off('cctv-alert', onCctv);
    };
  }, [socket, staff]);

  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(() => setAlert(null), 12000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!staff || !alert) return null;

  return (
    <div className="fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <div
        role="alert"
        className="max-w-lg rounded-xl border border-red-400 bg-red-600 px-5 py-4 text-center text-white shadow-2xl"
      >
        <p className="font-display text-lg font-bold">⚠ CCTV: Weapon / suspicious object</p>
        <p className="mt-1 text-sm opacity-95">{alert.body || alert.title}</p>
        {alert.userName && (
          <p className="mt-2 text-xs opacity-90">Source: {alert.userName}</p>
        )}
        <button
          type="button"
          className="mt-3 rounded-lg bg-white/20 px-4 py-1.5 text-sm font-medium hover:bg-white/30"
          onClick={() => setAlert(null)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
