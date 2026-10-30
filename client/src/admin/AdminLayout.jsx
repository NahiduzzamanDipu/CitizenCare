import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/admin', label: 'Overview', end: true, icon: GridIcon },
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
  { to: '/admin/stations', label: 'Police stations', icon: BuildingIcon },
  { to: '/admin/reports', label: 'Reports', icon: FileIcon },
  { to: '/admin/alerts', label: 'Emergency alerts', icon: SirenIcon },
  { to: '/admin/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/admin/audit', label: 'Audit log', icon: ShieldIcon },
];

function navClass({ isActive }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={navClass}
          onClick={() => setMobileOpen(false)}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[264px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 dark:shadow-card-dark lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-600 font-bold text-white">
                A
              </div>
              <div>
                <p className="font-display font-semibold text-slate-900 dark:text-white">
                  CitizenCare
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Admin portal
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
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className={`mt-4 ${mobileOpen ? 'block' : 'hidden lg:block'}`}>
            {nav}

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
                {user?.name || 'Administrator'}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {user?.email || ''}
              </p>
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

/* ------------------------------------------------------------------- icons */

function icon(path) {
  return function Icon({ className = '' }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        {path}
      </svg>
    );
  };
}

const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const GridIcon = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" {...stroke} />
    <rect x="14" y="3" width="7" height="7" rx="1.5" {...stroke} />
    <rect x="3" y="14" width="7" height="7" rx="1.5" {...stroke} />
    <rect x="14" y="14" width="7" height="7" rx="1.5" {...stroke} />
  </>
);
const UsersIcon = icon(
  <>
    <circle cx="9" cy="8" r="3.5" {...stroke} />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" {...stroke} />
    <path d="M16 5.5a3.5 3.5 0 0 1 0 6.9M18 20a6.4 6.4 0 0 0-1.6-4.3" {...stroke} />
  </>
);
const BuildingIcon = icon(
  <>
    <path d="M4 21V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15" {...stroke} />
    <path d="M15 10h4a1 1 0 0 1 1 1v10M2 21h20" {...stroke} />
    <path d="M8 9h3M8 13h3M8 17h3" {...stroke} />
  </>
);
const FileIcon = icon(
  <>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" {...stroke} />
    <path d="M14 3v4h4M9 13h6M9 17h4" {...stroke} />
  </>
);
const SirenIcon = icon(
  <>
    <path d="M7 17v-5a5 5 0 0 1 10 0v5" {...stroke} />
    <path d="M4 17h16v3H4zM12 3v2M4.5 7 6 8.2M19.5 7 18 8.2" {...stroke} />
  </>
);
const ChartIcon = icon(
  <>
    <path d="M4 20V4M4 20h16" {...stroke} />
    <path d="M8 16v-5M12 16V7M16 16v-8" {...stroke} />
  </>
);
const ShieldIcon = icon(
  <>
    <path d="M12 3l7 3v5.5c0 5-3.5 8.5-7 9.5-3.5-1-7-4.5-7-9.5V6l7-3Z" {...stroke} />
    <path d="M9.5 12l1.8 1.8L15 10" {...stroke} />
  </>
);
