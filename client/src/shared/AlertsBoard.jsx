import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../api/client';
import { useSocketEvent } from '../context/SocketContext';
import { Card, Badge, Spinner, Alert, EmptyState } from '../ui/Card';
import { Button, Select } from '../ui/Field';

const STATUS_TONE = { active: 'red', acknowledged: 'amber', resolved: 'green' };

/** Emergency SOS board — live, and shared by the police and admin portals. */
export function AlertsBoard() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await api.get(`/api/alerts${qs({ status })}`));
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('emergency', load);
  useSocketEvent('emergency-updated', load);

  async function transition(id, action) {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/api/alerts/${id}/${action}`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = items.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Emergency alerts
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Panic-button alerts arrive here in real time.
            {activeCount > 0 && (
              <strong className="ml-1 text-red-600 dark:text-red-400">
                {activeCount} awaiting response.
              </strong>
            )}
          </p>
        </div>
        <div className="w-44">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </Select>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No emergency alerts">
          When a citizen presses the panic button, the alert appears here
          instantly and notifies every officer on duty.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const [lng, lat] = a.location?.coordinates || [];
            return (
              <Card key={a._id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-semibold text-slate-900 dark:text-white">
                        {a.user?.name || 'Unknown citizen'}
                      </p>
                      <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      {a.message}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(a.createdAt).toLocaleString()}
                      {a.user?.phone ? ` · ${a.user.phone}` : ''}
                      {a.user?.email ? ` · ${a.user.email}` : ''}
                    </p>
                    {a.location?.address && (
                      <p className="text-xs text-slate-500">{a.location.address}</p>
                    )}
                    {Number.isFinite(lat) && Number.isFinite(lng) && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block font-mono text-xs text-brand-600 hover:underline"
                      >
                        {lat.toFixed(5)}, {lng.toFixed(5)} — open in Google Maps
                      </a>
                    )}
                    {a.acknowledgedBy && (
                      <p className="mt-1 text-xs text-slate-400">
                        Handled by {a.acknowledgedBy.name || 'staff'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      loading={busyId === a._id}
                      disabled={a.status !== 'active'}
                      onClick={() => transition(a._id, 'acknowledge')}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      variant="success"
                      className="px-3 py-1.5 text-xs"
                      loading={busyId === a._id}
                      disabled={a.status === 'resolved'}
                      onClick={() => transition(a._id, 'resolve')}
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
