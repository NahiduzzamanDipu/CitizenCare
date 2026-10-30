export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 dark:shadow-card-dark ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200',
};

export function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone] || TONES.slate} ${className}`}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-bold ${
          tone === 'danger'
            ? 'text-red-600 dark:text-red-400'
            : tone === 'warn'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Spinner({ className = 'h-6 w-6' }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-2 border-brand-600 border-t-transparent ${className}`}
    />
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </p>
      {children && (
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {children}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'red', children, className = '' }) {
  const styles = {
    red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    amber:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    brand:
      'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100',
  };
  return (
    <div
      role={tone === 'red' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${styles[tone] || styles.red} ${className}`}
    >
      {children}
    </div>
  );
}
