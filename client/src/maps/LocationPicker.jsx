import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import { useGoogleMaps, DEFAULT_CENTER } from './useGoogleMaps';
import { reverseGeocode, getCurrentPosition, formatCoords } from './geocode';

/**
 * Picks a point on a Google Map: search by place name, drag the pin, click the
 * map, or use the device GPS. Reports every change through `onChange` as
 * `{ lat, lng, address }`.
 *
 * With no Maps key configured it degrades to plain latitude/longitude inputs so
 * the surrounding form still works.
 */
export function LocationPicker({
  value,
  onChange,
  height = 320,
  label = 'Incident location',
  hint = 'Search, drag the pin, or tap the map.',
}) {
  const { isLoaded, loadError, hasKey } = useGoogleMaps();
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);

  const hasPoint = Number.isFinite(value?.lat) && Number.isFinite(value?.lng);
  const center = hasPoint ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER;

  const commit = useCallback(
    async (lat, lng, addressOverride) => {
      onChange({ lat, lng, address: addressOverride ?? value?.address ?? '' });
      if (addressOverride === undefined) {
        const address = await reverseGeocode(lat, lng);
        onChange({ lat, lng, address });
      }
    },
    [onChange, value?.address]
  );

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setStatus('');
    try {
      const { lat, lng } = await getCurrentPosition();
      await commit(lat, lng);
      mapRef.current?.panTo({ lat, lng });
      if (mapRef.current && mapRef.current.getZoom() < 15) mapRef.current.setZoom(16);
      setStatus('Location captured from your device.');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLocating(false);
    }
  }, [commit]);

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (!loc) {
      setStatus('No result for that search. Try a nearby landmark.');
      return;
    }
    const lat = loc.lat();
    const lng = loc.lng();
    commit(lat, lng, place.formatted_address || place.name || '');
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(16);
    setStatus('');
  }, [commit]);

  // Offer the device position immediately if the form starts empty.
  useEffect(() => {
    if (!hasPoint && isLoaded) setStatus('Tip: use "My location" to fill this in.');
    // Only on first load — a later empty value means the user cleared it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  if (!hasKey) {
    return (
      <ManualFallback
        value={value}
        onChange={onChange}
        onUseMyLocation={useMyLocation}
        locating={locating}
        status={status}
        label={label}
      />
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <MapErrorNotice error={loadError} />
        <ManualFallback
          value={value}
          onChange={onChange}
          onUseMyLocation={useMyLocation}
          locating={locating}
          status={status}
          label={label}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {isLoaded && (
          <div className="min-w-[200px] flex-1">
            <Autocomplete
              onLoad={(a) => {
                autocompleteRef.current = a;
              }}
              onPlaceChanged={onPlaceChanged}
              options={{ fields: ['geometry', 'formatted_address', 'name'] }}
            >
              <input
                type="text"
                placeholder="Search a place or address…"
                aria-label="Search for a location"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
            </Autocomplete>
          </div>
        )}
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {locating ? 'Locating…' : 'My location'}
        </button>
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
        style={{ height }}
      >
        {!isLoaded ? (
          <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-900">
            Loading map…
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={hasPoint ? 16 : 12}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            onUnmount={() => {
              mapRef.current = null;
            }}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
            onClick={(e) => {
              const lat = e.latLng?.lat();
              const lng = e.latLng?.lng();
              if (Number.isFinite(lat) && Number.isFinite(lng)) commit(lat, lng);
            }}
          >
            {hasPoint && (
              <Marker
                position={center}
                draggable
                onDragEnd={(e) => {
                  const lat = e.latLng?.lat();
                  const lng = e.latLng?.lng();
                  if (Number.isFinite(lat) && Number.isFinite(lng)) commit(lat, lng);
                }}
              />
            )}
          </GoogleMap>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          {hasPoint ? (
            <>
              <span className="font-mono">{formatCoords(value.lat, value.lng)}</span>
              {value.address ? ` · ${value.address}` : ''}
            </>
          ) : (
            'No location selected yet.'
          )}
        </span>
        {status && <span className="text-slate-500 dark:text-slate-400">{status}</span>}
      </div>
    </div>
  );
}

function ManualFallback({ value, onChange, onUseMyLocation, locating, status, label }) {
  const set = (patch) => onChange({ ...(value || {}), ...patch });
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{label}</p>
      <p className="text-xs text-amber-800 dark:text-amber-300">
        Set <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
        in <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">client/.env</code> to pick
        the location on a map. Enter coordinates manually for now.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Latitude
          <input
            type="number"
            step="any"
            value={value?.lat ?? ''}
            onChange={(e) => set({ lat: e.target.value === '' ? null : Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Longitude
          <input
            type="number"
            step="any"
            value={value?.lng ?? ''}
            onChange={(e) => set({ lng: e.target.value === '' ? null : Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        Address (optional)
        <input
          value={value?.address ?? ''}
          onChange={(e) => set({ address: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onUseMyLocation}
          disabled={locating}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
        >
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        {status && <span className="text-xs text-slate-600 dark:text-slate-300">{status}</span>}
      </div>
    </div>
  );
}

/** Google reports setup problems here — surface them instead of a blank box. */
export function MapErrorNotice({ error }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <p className="font-semibold">Google Maps failed to load.</p>
      <p className="mt-1">
        In Google Cloud Console check that <strong>billing is enabled</strong>, the{' '}
        <strong>Maps JavaScript API</strong> and <strong>Places API</strong> are enabled,
        and the key&rsquo;s HTTP referrer restrictions allow{' '}
        <code className="rounded bg-red-100 px-1 dark:bg-red-900">http://localhost:5173/*</code>.
      </p>
      <p className="mt-2 font-mono text-xs opacity-90">
        {String(error?.message || error)}
      </p>
    </div>
  );
}
