import { useCallback, useEffect, useState } from 'react';
import { api, mediaUrl, qs } from '../api/client';
import { useSocketEvent } from '../context/SocketContext';
import { Card, Badge, Spinner, Alert, EmptyState } from '../ui/Card';
import { Button, Select } from '../ui/Field';

const STATUS_TONE = {
  pending: 'amber',
  verified: 'green',
  fake: 'red',
  resolved: 'brand',
};

const CRIME_TYPES = [
  'theft',
  'assault',
  'vandalism',
  'traffic',
  'domestic',
  'drugs',
  'other',
];

const PAGE_SIZE = 15;

/**
 * The report verification queue, shared by the police command centre and the
 * admin portal — both roles have identical permissions over report status.
 */
export function ReportsQueue({ title = 'Incident reports', description }) {
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [crimeType, setCrimeType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(
        `/api/reports${qs({ page, limit: PAGE_SIZE, status, crimeType })}`
      );
      setData(res);
    } catch (e) {
      setError(e.message);
      setData({ items: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, status, crimeType]);

  useEffect(() => {
    load();
  }, [load]);

  // A newly filed report should appear without a manual refresh.
  useSocketEvent('notification', (payload) => {
    if (payload?.type === 'report') load();
  });

  async function setReportStatus(id, next) {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/api/reports/${id}/status`, { status: next });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description ||
            'Verify, reject or resolve citizen submissions. Verified reports appear on the public map immediately.'}
        </p>
      </header>

      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending review</option>
            <option value="verified">Verified</option>
            <option value="fake">Marked fake</option>
            <option value="resolved">Resolved</option>
          </Select>
          <Select
            label="Crime type"
            value={crimeType}
            onChange={(e) => {
              setPage(1);
              setCrimeType(e.target.value);
            }}
          >
            <option value="">All types</option>
            {CRIME_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
          <p className="pb-2 text-sm text-slate-500">
            {loading ? 'Loading…' : `${data.total} result${data.total === 1 ? '' : 's'}`}
          </p>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState title="Nothing in this queue">
          {status === 'pending'
            ? 'All submitted reports have been reviewed.'
            : 'No reports match the current filters.'}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {data.items.map((r) => (
            <ReportCard
              key={r._id}
              report={r}
              busy={busyId === r._id}
              onSetStatus={setReportStatus}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function ReportCard({ report: r, busy, onSetStatus }) {
  const [expanded, setExpanded] = useState(false);
  const long = r.description.length > 260;
  const coords = r.location?.coordinates;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {r.title}
            </h2>
            <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
            <Badge>{r.crimeType}</Badge>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
            {expanded || !long ? r.description : `${r.description.slice(0, 260)}…`}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-brand-600 hover:underline"
            >
              {expanded ? 'Show less' : 'Read full report'}
            </button>
          )}

          <p className="mt-3 text-xs text-slate-500">
            {new Date(r.createdAt).toLocaleString()} ·{' '}
            {r.submittedBy?.name || 'Unknown reporter'}
            {r.location?.address ? ` · ${r.location.address}` : ''}
          </p>

          {Array.isArray(coords) && coords.length === 2 && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-mono text-xs text-brand-600 hover:underline"
            >
              {coords[1].toFixed(5)}, {coords[0].toFixed(5)} — open in Google Maps
            </a>
          )}

          {r.reviewedBy && (
            <p className="mt-1 text-xs text-slate-400">
              Reviewed by {r.reviewedBy.name || 'staff'}
              {r.reviewedAt ? ` on ${new Date(r.reviewedAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="success"
            className="px-3 py-1.5 text-xs"
            loading={busy}
            disabled={r.status === 'verified'}
            onClick={() => onSetStatus(r._id, 'verified')}
          >
            Verify
          </Button>
          <Button
            variant="danger"
            className="px-3 py-1.5 text-xs"
            loading={busy}
            disabled={r.status === 'fake'}
            onClick={() => onSetStatus(r._id, 'fake')}
          >
            Mark fake
          </Button>
          <Button
            variant="dark"
            className="px-3 py-1.5 text-xs"
            loading={busy}
            disabled={r.status === 'resolved'}
            onClick={() => onSetStatus(r._id, 'resolved')}
          >
            Resolve
          </Button>
        </div>
      </div>

      {r.media?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {r.media.map((m, i) => (
            <a
              key={m.url || i}
              href={mediaUrl(m.url)}
              target="_blank"
              rel="noreferrer"
              className="group relative block h-20 w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            >
              {m.type === 'video' ? (
                <span className="flex h-full items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                  ▶ Video {i + 1}
                </span>
              ) : (
                <img
                  src={mediaUrl(m.url)}
                  alt={`Evidence ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              )}
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
