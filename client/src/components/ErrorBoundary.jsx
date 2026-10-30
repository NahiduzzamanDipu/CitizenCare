import { Component } from 'react';

/**
 * Catches render-time crashes so a single broken page shows a recovery screen
 * rather than a blank white document with the error only in the console.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            The page hit an unexpected error. Reloading usually clears it.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-left font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            {String(error?.message || error)}
          </pre>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Reload page
            </button>
            <a
              href="/"
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
