import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import {
  IncidentMap,
  reportToPoint,
  cctvToPoint,
  NoKeyNotice,
} from '../maps/IncidentMap';
import { hasGoogleMapsKey } from '../maps/useGoogleMaps';
import { Card, Badge, EmptyState, Alert } from '../ui/Card';
import { Select } from '../ui/Field';

const CRIME_TYPES = [
  { value: '', label: 'All types' },
  { value: 'theft', label: 'Theft' },
  { value: 'assault', label: 'Assault' },
  { value: 'vandalism', label: 'Vandalism' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'domestic', label: 'Domestic' },
  { value: 'drugs', label: 'Drugs' },
  { value: 'other', label: 'Other' },
];

/**
 * Public incident map. Anonymous visitors and citizens see verified reports plus
 * the anonymised CCTV feed; staff additionally get the full detection feed and
 * can filter by report status.
 */
export function LiveMap({ embedded = false }) {
  const { isStaff } = useAuth();
  const hasKey = hasGoogleMapsKey();

  const [crimeType, setCrimeType] = useState('');
  const [status, setStatus] = useState('verified');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reports, setReports] = useState([]);
  const [cctvEvents, setCctvEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const reportQuery = qs({
      crimeType,
      status: isStaff ? status : undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    });

    // Staff get the detailed feed; everyone else the anonymised public one.
    // These are settled independently so one failing endpoint (for example a
    // citizen hitting the staff-only route) cannot blank out the whole map.
    const [reportResult, cctvResult] = await Promise.allSettled([
      api.get(`/api/reports/map${reportQuery}`),
      api.get(
        isStaff ? '/api/cctv/map?limit=200' : '/api/cctv/public-map?limit=200'
      ),
    ]);

    if (reportResult.status === 'fulfilled') {
      setReports(Array.isArray(reportResult.value) ? reportResult.value : []);
    } else {
      setReports([]);
      setError(reportResult.reason?.message || 'Could not load incident reports.');
    }

    setCctvEvents(
      cctvResult.status === 'fulfilled' && Array.isArray(cctvResult.value)
        ? cctvResult.value
        : []
    );
    setLoading(false);
  }, [crimeType, status, from, to, isStaff]);

  useEffect(() => {
    load();
  }, [load]);

  // A verified report or a fresh detection should land on the map immediately.
  useSocketEvent('public-safety', load);

  useSocketEvent('cctv-alert', (payload) => {
    const { lat, lng } = payload?.location || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setCctvEvents((prev) => [
      {
        _id: payload.eventId || `live-${Date.now()}`,
        cameraId: payload.cameraId,
        place: payload.place,
        labels: payload.labels || [],
        location: { lat, lng, address: payload.location?.address || '' },
        createdAt: payload.createdAt || new Date().toISOString(),
      },
      ...prev.filter((e) => e._id !== payload.eventId),
    ]);
  });

  const points = useMemo(
    () =>
      [...reports.map(reportToPoint), ...cctvEvents.map(cctvToPoint)].filter(
        Boolean
      ),
    [reports, cctvEvents]
  );

  const filters = (
    <Card>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Crime type"
          value={crimeType}
          onChange={(e) => setCrimeType(e.target.value)}
        >
          {CRIME_TYPES.map((t) => (
            <option key={t.label} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        {isStaff && (
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="fake">Marked fake</option>
          </Select>
        )}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          From
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          To
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      {!embedded && (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
              Live incident map
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isStaff
                ? 'Every report and CCTV weapon detection, updating in real time.'
                : 'Verified incidents and anonymised CCTV detections near you.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{reports.length} reports</Badge>
            <Badge tone="red">{cctvEvents.length} detections</Badge>
            {loading && <span className="text-xs text-slate-500">Updating…</span>}
          </div>
        </header>
      )}

      {error && <Alert>{error}</Alert>}

      {filters}

      {hasKey ? (
        <IncidentMap points={points} height={embedded ? 380 : 520} />
      ) : (
        <>
          <NoKeyNotice />
          <ReportTable reports={reports} />
        </>
      )}

      {hasKey && points.length === 0 && !loading && (
        <EmptyState title="No incidents match these filters">
          Widen the date range or clear the crime-type filter.
        </EmptyState>
      )}
    </div>
  );
}

function ReportTable({ reports }) {
  if (!reports.length) {
    return <EmptyState title="No incidents match these filters" />;
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const [lng, lat] = r.location?.coordinates || [];
              return (
                <tr key={r._id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                    {r.title}
                  </td>
                  <td className="px-4 py-2">
                    <Badge>{r.crimeType}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
                    {r.location?.address ||
                      (Number.isFinite(lat) ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '—')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
