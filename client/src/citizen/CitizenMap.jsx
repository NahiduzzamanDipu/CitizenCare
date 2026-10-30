import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useSocketEvent } from '../context/SocketContext';
import { IncidentMap, reportToPoint, cctvToPoint, NoKeyNotice } from '../maps/IncidentMap';
import { hasGoogleMapsKey } from '../maps/useGoogleMaps';
import { getCurrentPosition } from '../maps/geocode';

const SAFETY_STYLES = {
  'HIGH RISK': {
    wrap: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    dot: 'bg-red-500',
    title: 'High risk area',
    text: 'Several recent incidents nearby. Avoid if you can and stay alert.',
    color: '#ef4444',
  },
  'LOW RISK': {
    wrap: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    dot: 'bg-amber-500',
    title: 'Low risk area',
    text: 'A little recent activity here. Stay aware of your surroundings.',
    color: '#f59e0b',
  },
  SAFE: {
    wrap: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
    dot: 'bg-emerald-500',
    title: 'This area looks safe',
    text: 'No recent incidents recorded nearby.',
    color: '#22c55e',
  },
};

const PENDING_STYLE = {
  wrap: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  dot: 'bg-slate-300',
  title: 'Safety check',
  text: 'Analysing recent activity around you…',
  color: '#64748b',
};

/**
 * The citizen safety map: your position, nearby verified incidents and CCTV
 * detections, and a live risk assessment for whatever point you tap.
 */
export function CitizenMap() {
  const hasKey = hasGoogleMapsKey();

  const [me, setMe] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [reports, setReports] = useState([]);
  const [cctvEvents, setCctvEvents] = useState([]);
  const [safety, setSafety] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentPosition()
      .then((pos) => !cancelled && setMe(pos))
      .catch(() => {
        // Location is optional here — the map falls back to the default centre.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadIncidents = useCallback(async () => {
    const [reportRes, cctvRes] = await Promise.allSettled([
      api.get('/api/reports/map'),
      api.get('/api/cctv/public-map?limit=120'),
    ]);
    setReports(reportRes.status === 'fulfilled' ? reportRes.value || [] : []);
    setCctvEvents(cctvRes.status === 'fulfilled' ? cctvRes.value || [] : []);
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const activePoint = selectedPoint || me;

  const loadSafety = useCallback(async (pt) => {
    if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return;
    setSafetyLoading(true);
    try {
      setSafety(
        await api.get(
          `/api/safety-status?lat=${pt.lat}&lng=${pt.lng}&radiusM=1000&days=14`
        )
      );
    } catch {
      setSafety(null);
    } finally {
      setSafetyLoading(false);
    }
  }, []);

  const activeLat = activePoint?.lat;
  const activeLng = activePoint?.lng;
  useEffect(() => {
    if (Number.isFinite(activeLat) && Number.isFinite(activeLng)) {
      loadSafety({ lat: activeLat, lng: activeLng });
    }
  }, [loadSafety, activeLat, activeLng]);

  // A newly verified report or CCTV detection changes the picture — refresh.
  useSocketEvent('public-safety', () => {
    loadIncidents();
    loadSafety(activePoint);
  });

  const points = useMemo(
    () =>
      [...reports.map(reportToPoint), ...cctvEvents.map(cctvToPoint)].filter(
        Boolean
      ),
    [reports, cctvEvents]
  );

  const style = safety ? SAFETY_STYLES[safety.status] || PENDING_STYLE : PENDING_STYLE;

  return (
    <div className="space-y-3">
      <SafetyCard
        style={style}
        safety={safety}
        loading={safetyLoading}
        point={activePoint}
        isSelected={Boolean(selectedPoint)}
        onClearSelection={() => setSelectedPoint(null)}
      />

      {hasKey ? (
        <IncidentMap
          points={points}
          center={activePoint || undefined}
          zoom={activePoint ? 14 : 12}
          height={280}
          showLegend={false}
          highlight={
            activePoint
              ? {
                  ...activePoint,
                  radius: 1000,
                  color: style.color,
                  label: selectedPoint ? 'Selected spot' : 'You are here',
                }
              : null
          }
          onMapClick={(pt) => setSelectedPoint(pt)}
        />
      ) : (
        <NoKeyNotice />
      )}

      {hasKey && (
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
          Tap anywhere on the map to check that spot&rsquo;s safety.
        </p>
      )}
    </div>
  );
}

function SafetyCard({ style, safety, loading, point, isSelected, onClearSelection }) {
  const breakdown = safety?.breakdown;

  return (
    <div className={`rounded-3xl border p-4 ${style.wrap}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 dark:bg-slate-900/50">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {loading ? 'Checking this area…' : style.title}
            </p>
            {isSelected && (
              <button
                type="button"
                onClick={onClearSelection}
                className="shrink-0 text-[11px] font-medium text-slate-500 hover:underline dark:text-slate-400"
              >
                Back to me
              </button>
            )}
          </div>

          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            {style.text}
          </p>

          {breakdown && (
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Last {breakdown.days} days within {breakdown.radiusM} m:{' '}
              <strong>{breakdown.recentCrimes}</strong> verified report
              {breakdown.recentCrimes === 1 ? '' : 's'},{' '}
              <strong>{breakdown.weaponDetections}</strong> weapon detection
              {breakdown.weaponDetections === 1 ? '' : 's'}.
            </p>
          )}

          {safety?.note && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {safety.note}
            </p>
          )}

          {point && (
            <p className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
              {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
