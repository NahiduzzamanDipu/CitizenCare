import { Link } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext';

export function NotFound() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <p className="font-display text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        That address does not exist, or you do not have access to it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to={user ? homePathFor(user.role) : '/'}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {user ? 'Back to my dashboard' : 'Back home'}
        </Link>
        <Link
          to="/map"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Open the live map
        </Link>
      </div>
    </div>
  );
}
