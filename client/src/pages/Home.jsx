import { Link } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext';
import { Card } from '../ui/Card';

const features = [
  {
    title: 'Report with precision',
    body: 'Search an address or drop a pin on the map, attach photos or video, and track the review status of every report you file.',
  },
  {
    title: 'Know before you go',
    body: 'Tap anywhere on the map for a live risk assessment built from verified reports and CCTV detections in the last two weeks.',
  },
  {
    title: 'One-tap emergency',
    body: 'The panic button sends your exact position to every officer on duty, and tells you the moment someone acknowledges it.',
  },
  {
    title: 'AI weapon detection',
    body: 'Any phone or webcam becomes a CCTV node. Frames are analysed once a second by YOLOv8 and flagged threats alert the command centre instantly.',
  },
];

export function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh]">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card dark:bg-slate-900 dark:shadow-card-dark">
            <ShieldIcon className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Citizen<span className="text-brand-600">Care</span>
          </h1>
          <p className="mt-3 text-sm font-medium uppercase tracking-widest text-slate-400">
            Smart public safety &amp; crime alert system
          </p>
          <p className="mx-auto mt-5 max-w-xl text-balance text-slate-600 dark:text-slate-400">
            Citizens report what they see. Officers verify and respond. AI watches
            the cameras. Everything on one live map.
          </p>

          {user ? (
            <Link
              to={homePathFor(user.role)}
              className="mt-8 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Continue to your dashboard
            </Link>
          ) : (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Create a free account
              </Link>
              <Link
                to="/map"
                className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Browse the live map
              </Link>
            </div>
          )}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <PortalCard
            to={user?.role === 'police' ? '/police/dashboard' : '/login'}
            title="Police command"
            body="Verify reports, watch live camera feeds and dispatch on emergency alerts."
            footnote="Officers register with a station code issued by an administrator."
            accent="brand"
          />
          <PortalCard
            to={user && user.role === 'citizen' ? '/app' : '/register'}
            title="Citizen app"
            body="Check your area's safety, report incidents with evidence, and raise an SOS."
            footnote="Open to everyone — no invitation needed."
            accent="emerald"
          />
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {f.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {f.body}
              </p>
            </Card>
          ))}
        </div>

        {!user && (
          <p className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500">
            Administrators sign in at{' '}
            <Link to="/login" className="hover:underline">
              /login
            </Link>{' '}
            with an account created during setup.
          </p>
        )}
      </div>
    </div>
  );
}

function PortalCard({ to, title, body, footnote, accent }) {
  const ring =
    accent === 'emerald'
      ? 'hover:border-emerald-300 dark:hover:border-emerald-700'
      : 'hover:border-brand-300 dark:hover:border-brand-700';
  return (
    <Link to={to}>
      <Card className={`h-full p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${ring}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </p>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{body}</p>
          </div>
          <ArrowIcon className="h-5 w-5 shrink-0 text-slate-400" />
        </div>
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">{footnote}</p>
      </Card>
    </Link>
  );
}

function ShieldIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2l8 4v6c0 7-4.8 10.8-8 11.9C8.8 22.8 4 19 4 12V6l8-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
