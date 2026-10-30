import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { NotificationHost } from './NotificationHost';
import { CCTVStaffBanner } from '../cctv-module';

/**
 * The police and admin portals render their own full-height chrome, so the
 * public navbar and page padding are suppressed on those routes.
 */
export function Layout({ children }) {
  const { pathname } = useLocation();
  const isPortal = pathname.startsWith('/police') || pathname.startsWith('/admin');
  const isCitizenApp = pathname.startsWith('/app');

  return (
    <div className="min-h-screen bg-surface-muted dark:bg-slate-950">
      {!isPortal && <Navbar />}
      <CCTVStaffBanner />
      <NotificationHost />
      {isPortal ? (
        <div className="min-h-screen">{children}</div>
      ) : isCitizenApp ? (
        <main>{children}</main>
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      )}
    </div>
  );
}
