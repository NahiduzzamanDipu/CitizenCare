import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext';
import { api } from '../api/client';
import { TextInput, Select, Button } from '../ui/Field';
import { Alert } from '../ui/Card';

const TABS = [
  {
    key: 'citizen',
    label: 'Citizen',
    blurb: 'Open to everyone. Report incidents, see your area’s safety status, and raise an SOS.',
  },
  {
    key: 'police',
    label: 'Police',
    blurb: 'Restricted. You need your station’s registration code, issued by an administrator.',
  },
];

export function Register() {
  const [params] = useSearchParams();
  const initialTab = params.get('as') === 'police' ? 'police' : 'citizen';
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 dark:shadow-card-dark sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Create your account
        </h1>

        <div
          role="tablist"
          aria-label="Account type"
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {TABS.find((t) => t.key === tab)?.blurb}
        </p>

        {tab === 'citizen' ? <CitizenForm /> : <PoliceForm />}

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Shared submit plumbing: error surface, busy state, post-signup redirect. */
function useSignup(submitFn) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handle(e, payload) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await submitFn(payload);
      navigate(homePathFor(res.user?.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return { error, submitting, handle };
}

function CitizenForm() {
  const { registerCitizen } = useAuth();
  const { error, submitting, handle } = useSignup(registerCitizen);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    phone: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  return (
    <form
      onSubmit={(e) =>
        handle(e, {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
        })
      }
      className="mt-6 space-y-4"
    >
      {error && <Alert>{error}</Alert>}

      <TextInput
        label="Full name"
        required
        autoComplete="name"
        value={form.name}
        onChange={set('name')}
      />
      <TextInput
        label="Email"
        type="email"
        required
        autoComplete="email"
        value={form.email}
        onChange={set('email')}
      />
      <TextInput
        label="Password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters."
        value={form.password}
        onChange={set('password')}
      />
      <TextInput
        label="Confirm password"
        type="password"
        required
        autoComplete="new-password"
        error={mismatch ? 'Passwords do not match.' : ''}
        value={form.confirm}
        onChange={set('confirm')}
      />
      <TextInput
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        hint="Helps responders reach you after an SOS."
        value={form.phone}
        onChange={set('phone')}
      />

      <Button
        type="submit"
        loading={submitting}
        disabled={mismatch}
        className="w-full py-3"
      >
        {submitting ? 'Creating account…' : 'Create citizen account'}
      </Button>
    </form>
  );
}

function PoliceForm() {
  const { registerPolice } = useAuth();
  const { error, submitting, handle } = useSignup(registerPolice);

  const [stations, setStations] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    phone: '',
    badgeId: '',
    stationCode: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // The directory is public, but it never includes codes — it exists so an
  // officer can confirm their station is registered before asking for one.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/stations/public')
      .then((list) => {
        if (!cancelled) setStations(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setStations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  return (
    <form
      onSubmit={(e) =>
        handle(e, {
          name: form.name,
          email: form.email,
          password: form.password,
          stationCode: form.stationCode.trim(),
          badgeId: form.badgeId || undefined,
          phone: form.phone || undefined,
        })
      }
      className="mt-6 space-y-4"
    >
      {error && <Alert>{error}</Alert>}

      <Alert tone="brand">
        Police accounts are not self-service. Ask your station administrator for
        the registration code — it is issued from the admin portal and can be
        rotated at any time.
      </Alert>

      <TextInput
        label="Station registration code"
        required
        value={form.stationCode}
        onChange={(e) =>
          setForm((f) => ({ ...f, stationCode: e.target.value.toUpperCase() }))
        }
        placeholder="PS-XXXXXXXX"
        className="font-mono tracking-wider"
        hint="Case-insensitive."
      />

      {stations.length > 0 && (
        <Select
          label="Your station (reference only)"
          value=""
          onChange={() => {}}
          hint="Listed stations are registered in the system. The code is still required."
        >
          <option value="">
            {stations.length} station{stations.length === 1 ? '' : 's'} registered
          </option>
          {stations.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
              {s.district ? ` — ${s.district}` : ''}
            </option>
          ))}
        </Select>
      )}

      <TextInput
        label="Full name"
        required
        autoComplete="name"
        value={form.name}
        onChange={set('name')}
      />
      <TextInput
        label="Official email"
        type="email"
        required
        autoComplete="email"
        value={form.email}
        onChange={set('email')}
      />
      <TextInput
        label="Badge / service number (optional)"
        value={form.badgeId}
        onChange={set('badgeId')}
      />
      <TextInput
        label="Password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters."
        value={form.password}
        onChange={set('password')}
      />
      <TextInput
        label="Confirm password"
        type="password"
        required
        autoComplete="new-password"
        error={mismatch ? 'Passwords do not match.' : ''}
        value={form.confirm}
        onChange={set('confirm')}
      />
      <TextInput
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        value={form.phone}
        onChange={set('phone')}
      />

      <Button
        type="submit"
        loading={submitting}
        disabled={mismatch}
        className="w-full py-3"
      >
        {submitting ? 'Verifying code…' : 'Register officer account'}
      </Button>
    </form>
  );
}
