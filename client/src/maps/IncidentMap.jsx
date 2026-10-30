import { useCallback, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { useGoogleMaps, DEFAULT_CENTER, DARK_MAP_STYLES } from './useGoogleMaps';
import { MapErrorNotice } from './LocationPicker';
import { useTheme } from '../context/ThemeContext';

/** Marker colour per crime type, so the map reads at a glance. */
const TYPE_COLORS = {
  theft: '#f59e0b',
  assault: '#ef4444',
  vandalism: '#a855f7',
  traffic: '#0ea5e9',
  domestic: '#ec4899',
  drugs: '#14b8a6',
  other: '#64748b',
  weapon: '#dc2626',
  sos: '#e11d48',
};

/** Data-URI pin so markers need no external image host. */
function pinIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 27 15 27s15-16 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>
    <circle cx="15" cy="15" r="6" fill="#fff" opacity="0.9"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * The shared incident map. Takes already-normalised points so the citizen map,
 * the public map and the command-centre map all render identically:
 *
 *   { id, lat, lng, kind, title, subtitle, when, severity }
 */
export function IncidentMap({
  points = [],
  center,
  zoom,
  height = 480,
  showLegend = true,
  highlight = null,
  onMapClick,
  children,
}) {
  const { isLoaded, loadError, hasKey } = useGoogleMaps();
  const { theme } = useTheme();
  const [selected, setSelected] = useState(null);
  const mapRef = useRef(null);

  const resolvedCenter = useMemo(() => {
    if (center) return center;
    const first = points.find((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return first ? { lat: first.lat, lng: first.lng } : DEFAULT_CENTER;
  }, [center, points]);

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  if (!hasKey) return <NoKeyNotice />;
  if (loadError) return <MapErrorNotice error={loadError} />;

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"
        style={{ height }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
        style={{ height }}
      >
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={resolvedCenter}
          zoom={zoom ?? (points.length ? 12 : 11)}
          onLoad={onLoad}
          onUnmount={() => {
            mapRef.current = null;
          }}
          onClick={(e) => {
            setSelected(null);
            const lat = e.latLng?.lat();
            const lng = e.latLng?.lng();
            if (onMapClick && Number.isFinite(lat) && Number.isFinite(lng)) {
              onMapClick({ lat, lng });
            }
          }}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            styles: theme === 'dark' ? DARK_MAP_STYLES : undefined,
          }}
        >
          {highlight && Number.isFinite(highlight.lat) && (
            <>
              <Circle
                center={highlight}
                radius={highlight.radius ?? 400}
                options={{
                  fillColor: highlight.color || '#22c55e',
                  fillOpacity: 0.12,
                  strokeColor: highlight.color || '#22c55e',
                  strokeOpacity: 0.6,
                  strokeWeight: 2,
                  clickable: false,
                }}
              />
              <Marker
                position={highlight}
                icon={pinIcon(highlight.color || '#22c55e')}
                title={highlight.label || 'You are here'}
                zIndex={999}
              />
            </>
          )}

          {points.map((p) => (
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              icon={pinIcon(TYPE_COLORS[p.kind] || TYPE_COLORS.other)}
              title={p.title}
              onClick={() => setSelected(p)}
            />
          ))}

          {selected && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="max-w-[240px] text-slate-900">
                <p className="text-sm font-semibold">{selected.title}</p>
                {selected.subtitle && (
                  <p className="mt-1 text-xs text-slate-600">{selected.subtitle}</p>
                )}
                {selected.when && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {new Date(selected.when).toLocaleString()}
                  </p>
                )}
              </div>
            </InfoWindow>
          )}

          {children}
        </GoogleMap>
      </div>

      {showLegend && <Legend points={points} />}
    </div>
  );
}

function Legend({ points }) {
  const kinds = useMemo(() => {
    const counts = new Map();
    for (const p of points) counts.set(p.kind, (counts.get(p.kind) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [points]);

  if (!kinds.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {kinds.map(([kind, count]) => (
        <span
          key={kind}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: TYPE_COLORS[kind] || TYPE_COLORS.other }}
          />
          {kind === 'weapon' ? 'CCTV weapon' : kind} · {count}
        </span>
      ))}
    </div>
  );
}

export function NoKeyNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold">Google Maps is not configured.</p>
      <p className="mt-1">
        Add <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
        to <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">client/.env</code> and restart
        the dev server. Incident data is still listed below.
      </p>
    </div>
  );
}

/** Normalises a CrimeReport document into an IncidentMap point. */
export function reportToPoint(r) {
  const c = r.location?.coordinates;
  if (!Array.isArray(c) || c.length !== 2) return null;
  const [lng, lat] = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: `report-${r._id}`,
    lat,
    lng,
    kind: r.crimeType || 'other',
    title: r.title,
    subtitle: r.location?.address || r.crimeType,
    when: r.createdAt,
  };
}

/** Normalises a CctvEvent document into an IncidentMap point. */
export function cctvToPoint(e) {
  const lat = e?.location?.lat;
  const lng = e?.location?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: `cctv-${e._id}`,
    lat,
    lng,
    kind: 'weapon',
    title: `CCTV: ${(e.labels || []).join(', ') || 'weapon detected'}`,
    subtitle: [e.cameraId, e.place].filter(Boolean).join(' · '),
    when: e.createdAt,
  };
}

export { TYPE_COLORS };
