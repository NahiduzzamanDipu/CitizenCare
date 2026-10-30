/**
 * Thin promise wrappers over the Geocoding service, plus a graceful fallback
 * so callers still get *something* useful when no key is configured.
 */

let geocoder = null;

function getGeocoder() {
  if (!window.google?.maps?.Geocoder) return null;
  if (!geocoder) geocoder = new window.google.maps.Geocoder();
  return geocoder;
}

export function formatCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Coordinates → human-readable address. Falls back to the raw coordinates. */
export async function reverseGeocode(lat, lng) {
  const g = getGeocoder();
  if (!g) return formatCoords(lat, lng);
  try {
    const { results } = await g.geocode({ location: { lat, lng } });
    return results?.[0]?.formatted_address || formatCoords(lat, lng);
  } catch {
    return formatCoords(lat, lng);
  }
}

/** Address → coordinates. Resolves to null when nothing matches. */
export async function forwardGeocode(address) {
  const g = getGeocoder();
  if (!g || !address?.trim()) return null;
  try {
    const { results } = await g.geocode({ address });
    const first = results?.[0];
    if (!first) return null;
    return {
      lat: first.geometry.location.lat(),
      lng: first.geometry.location.lng(),
      address: first.formatted_address,
    };
  } catch {
    return null;
  }
}

/**
 * Reads the device position. Rejects with a message that is safe to show the
 * user — browsers phrase these errors inconsistently.
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support location access.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: 'Location permission was denied. Enable it in your browser settings, or pick the spot on the map.',
          2: 'Your position is unavailable right now. Try again or pick the spot on the map.',
          3: 'Timed out while locating you. Try again or pick the spot on the map.',
        };
        reject(new Error(messages[err.code] || 'Could not read your location.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000, ...options }
    );
  });
}
