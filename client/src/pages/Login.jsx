import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext';
import { TextInput, Button } from '../ui/Field';
import { Alert } from '../ui/Card';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await login(email, password);
      // Return the user where they were headed, unless that page is not for
      // their role — then send them to their own home.
      navigate(from || homePathFor(res.user?.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 dark:shadow-card-dark sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Citizens, officers and administrators all sign in here.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <Alert>{error}</Alert>}

          <TextInput
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextInput
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" loading={submitting} className="w-full py-3">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create a citizen account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
          Officers register at{' '}
          <Link to="/register?as=police" className="hover:underline">
            /register
          </Link>{' '}
          with a station code.
        </p>
      </div>
    </div>
  );
}
