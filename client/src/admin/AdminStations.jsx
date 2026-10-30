import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, CardHeader, Badge, Spinner, Alert, EmptyState } from '../ui/Card';
import { Button, TextInput } from '../ui/Field';
import { LocationPicker } from '../maps/LocationPicker';

/**
 * Station management. The registration code shown here is the credential that
 * gates police signup, so it is masked until an admin chooses to reveal it.
 */
export function AdminStations() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revealed, setRevealed] = useState(() => new Set());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.get('/api/stations?includeCodes=true');
      setStations(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleReveal(id) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`Copied ${code} to the clipboard.`);
    } catch {
      setNotice(`Code: ${code}`);
    }
  }

  async function rotate(station) {
    if (
      !window.confirm(
        `Rotate the code for ${station.name}? Anyone holding the old code will no longer be able to register.`
      )
    ) {
      return;
    }
    setError('');
    try {
      const res = await api.post(`/api/stations/${station._id}/rotate-code`);
      setNotice(`New code for ${station.name}: ${res.code}`);
      setRevealed((prev) => new Set(prev).add(station._id));
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleActive(station) {
    setError('');
    try {
      await api.patch(`/api/stations/${station._id}`, {
        isActive: !station.isActive,
      });
      setNotice(
        `${station.name} ${station.isActive ? 'deactivated' : 'reactivated'}.`
      );
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(station) {
    if (!window.confirm(`Delete ${station.name}?`)) return;
    setError('');
    try {
      await api.delete(`/api/stations/${station._id}`);
      setNotice(`Deleted ${station.name}.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Police stations
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Each station has a registration code. An officer must enter it at
            signup to receive the police role — share it privately, and rotate it
            if it leaks.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>Add station</Button>
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="green">{notice}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : stations.length === 0 ? (
        <EmptyState
          title="No stations yet"
          action={<Button onClick={() => setCreating(true)}>Add the first station</Button>}
        >
          Until a station exists, nobody can register as police — which is the
          safe default.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {stations.map((s) => (
            <Card key={s._id}>
              <CardHeader
                title={s.name}
                subtitle={[s.district, s.address].filter(Boolean).join(' · ') || 'No address'}
                right={
                  <Badge tone={s.isActive ? 'green' : 'red'}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                }
              />
              <div className="space-y-4 px-5 pb-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Registration code
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-white px-2.5 py-1 font-mono text-sm tracking-wider text-slate-900 dark:bg-slate-800 dark:text-white">
                      {revealed.has(s._id) ? s.code : '•'.repeat(s.code?.length || 12)}
                    </code>
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => toggleReveal(s._id)}
                    >
                      {revealed.has(s._id) ? 'Hide' : 'Reveal'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => copyCode(s.code)}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => rotate(s)}
                    >
                      Rotate
                    </Button>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Officers registered</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {s.officerCount ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Phone</dt>
                    <dd className="text-slate-700 dark:text-slate-200">
                      {s.phone || '—'}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => toggleActive(s)}
                  >
                    {s.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => remove(s)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <CreateStationDialog
          onClose={() => setCreating(false)}
          onCreated={(station) => {
            setCreating(false);
            setNotice(
              `Created ${station.name}. Registration code: ${station.code} — copy it now.`
            );
            setRevealed((prev) => new Set(prev).add(station._id));
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateStationDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    district: '',
    address: '',
    phone: '',
    code: '',
  });
  const [point, setPoint] = useState({ lat: null, lng: null, address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const station = await api.post('/api/stations', {
        name: form.name,
        district: form.district || undefined,
        address: form.address || point.address || undefined,
        phone: form.phone || undefined,
        code: form.code.trim() || undefined,
        lat: Number.isFinite(point.lat) ? point.lat : undefined,
        lng: Number.isFinite(point.lng) ? point.lng : undefined,
      });
      onCreated(station);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Add a police station
        </h2>

        <div className="mt-5 space-y-4">
          {error && <Alert>{error}</Alert>}

          <TextInput
            label="Station name"
            required
            value={form.name}
            onChange={set('name')}
            placeholder="Central Police Station"
          />
          <TextInput
            label="District"
            value={form.district}
            onChange={set('district')}
          />
          <TextInput
            label="Address"
            value={form.address}
            onChange={set('address')}
            placeholder={point.address || 'Street address'}
          />
          <TextInput label="Phone" value={form.phone} onChange={set('phone')} />
          <TextInput
            label="Registration code (optional)"
            value={form.code}
            onChange={(e) =>
              setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
            }
            className="font-mono tracking-wider"
            hint="Leave blank to have a secure code generated for you."
          />

          <LocationPicker
            value={point}
            onChange={setPoint}
            height={220}
            label="Station location (optional)"
            hint="Shown on the command-centre map."
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!form.name.trim()}>
            Create station
          </Button>
        </div>
      </form>
    </div>
  );
}
