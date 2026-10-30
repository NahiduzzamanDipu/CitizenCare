import { useId } from 'react';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-white';

export function Field({ label, hint, error, children, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : (
        hint && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )
      )}
    </div>
  );
}

export function TextInput({ label, hint, error, required, className = '', ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        className={`${inputClass} ${error ? 'border-red-400 dark:border-red-700' : ''} ${className}`}
        {...props}
      />
    </Field>
  );
}

export function TextArea({ label, hint, error, required, className = '', ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <textarea
        required={required}
        aria-invalid={error ? 'true' : undefined}
        className={`${inputClass} ${error ? 'border-red-400 dark:border-red-700' : ''} ${className}`}
        {...props}
      />
    </Field>
  );
}

export function Select({ label, hint, error, required, children, className = '', ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <select
        required={required}
        className={`${inputClass} ${className}`}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  loading,
  children,
  ...props
}) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost:
      'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800',
    dark: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
