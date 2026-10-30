import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/police/dashboard', label: 'Dashboard' },
  { to: '/police/live-feeds', label: 'Live feeds' },
  { to: '/police/incidents', label: 'Incidents' },
  { to: '/police/alerts', label: 'Emergency SOS' },
  { to: '/police/map', label: 'Map view' },
  { to: '/police/analytics', label: 'Analytics' },
  { to: '/police/settings', label: 'Settings' },
];

function navClass({ isActive }) {
  return `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;
}

export function PoliceLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 dark:shadow-card-dark lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white">
                C
              </div>
              <div>
                <p className="font-display font-semibold text-slate-900 dark:text-white">
                  CitizenCare
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Police command
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden dark:border-slate-700 dark:text-slate-300"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className={`mt-4 ${mobileOpen ? 'block' : 'hidden lg:block'}`}>
            <nav className="space-y-1">
              {navItems.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  className={navClass}
                  onClick={() => setMobileOpen(false)}
                  end
                >
                  {i.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`}
                />
                <p className="text-xs font-medium text-slate-500">
                  {connected ? 'Realtime connected' : 'Realtime offline'}
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                {user?.name || 'Officer'}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {user?.email || ''}
              </p>
              {user?.station?.name && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {user.station.name}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggle}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
