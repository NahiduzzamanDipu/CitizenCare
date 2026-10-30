import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { getCurrentPosition, reverseGeocode } from '../maps/geocode';
import { LocationPicker } from '../maps/LocationPicker';
import { Button, TextInput } from '../ui/Field';
import { Alert } from '../ui/Card';

/**
 * Panic button. The priority is getting a position and firing the alert with as
 * few taps as possible, so location capture starts automatically on mount and
 * the map picker is only revealed if that fails or the user wants to adjust it.
 */
export function Emergency() {
  const [message, setMessage] = useState('Emergency SOS');
  const [point, setPoint] = useState({ lat: null, lng: null, address: '' });
  const [locating, setLocating] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const locate = useCallback(async () => {
    setLocating(true);
    setError('');
    try {
      const { lat, lng } = await getCurrentPosition();
      const address = await reverseGeocode(lat, lng);
      setPoint({ lat, lng, address });
    } catch (err) {
      setError(err.message);
      setShowPicker(true);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const hasLocation = Number.isFinite(point.lat) && Number.isFinite(point.lng);

  async function sendAlert() {
    if (!hasLocation) {
      setError('A location is required so responders know where to go.');
      setShowPicker(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const alert = await api.post('/api/alerts', {
        message,
        lat: point.lat,
        lng: point.lng,
        address: point.address,
      });
      setSent(alert);
    } catch (e) {
      setError(e.message || 'Failed to send the alert.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-8 py-12 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
              <path
                d="m5 13 4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            SOS sent
          </h1>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
            Every officer on duty has been alerted with your location. You will be
            notified when someone acknowledges it.
          </p>
          {point.address && (
            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
              Sent from: {point.address}
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="tel:999">
              <Button variant="danger">Call 999 now</Button>
            </a>
            <Button variant="ghost" onClick={() => setSent(null)}>
              Send another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-3xl border border-red-200 bg-gradient-to-b from-red-50 to-white p-6 shadow-lg dark:border-red-900 dark:from-red-950/50 dark:to-slate-900 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">
          Emergency
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
          Panic button
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Sends your live location to every officer on duty. For immediate danger,
          call <a href="tel:999" className="font-semibold text-red-600 hover:underline">999</a> as well.
        </p>

        {error && (
          <div className="mt-5">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Your location
                </p>
                {locating ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Locating you…
                  </p>
                ) : hasLocation ? (
                  <>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                      {point.address || 'Location captured'}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    No location yet
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  onClick={locate}
                  loading={locating}
                >
                  Retry GPS
                </Button>
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => setShowPicker((v) => !v)}
                >
                  {showPicker ? 'Hide map' : 'Set manually'}
                </Button>
              </div>
            </div>
          </div>

          {showPicker && (
            <LocationPicker
              value={point}
              onChange={setPoint}
              height={240}
              label="Adjust your location"
              hint="Drag the pin to where help is needed."
            />
          )}

          <TextInput
            label="Message to responders"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            placeholder="What is happening?"
          />
        </div>

        <button
          type="button"
          disabled={loading || locating || !hasLocation}
          onClick={sendAlert}
          className="mt-8 w-full rounded-2xl bg-red-600 py-5 text-lg font-bold tracking-wide text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'SEND SOS'}
        </button>

        {!hasLocation && !locating && (
          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            Allow location access or set your position on the map to send.
          </p>
        )}
      </div>
    </div>
  );
}
