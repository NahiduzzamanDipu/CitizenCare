import { useJsApiLoader } from '@react-google-maps/api';

/**
 * Every map in the app must load the Google Maps script with *identical*
 * options — `useJsApiLoader` throws "Loader must not be called again with
 * different options" if two components disagree on the id or libraries, which
 * is what happens as soon as a user navigates between two map pages.
 *
 * Import these constants everywhere instead of writing them inline.
 */
export const GOOGLE_MAPS_LOADER_ID = 'citizencare-google-maps';

// `places` powers the address search box; `geometry` the distance helpers.
// Frozen and module-level so the array identity never changes between renders.
export const GOOGLE_MAPS_LIBRARIES = Object.freeze(['places', 'geometry']);

export function getGoogleMapsApiKey() {
  return (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

/** True when a usable key is configured (the placeholder from .env.example doesn't count). */
export function hasGoogleMapsKey() {
  const key = getGoogleMapsApiKey();
  return Boolean(key) && !/^YOUR_/i.test(key);
}

/**
 * Loads the Maps JavaScript API.
 *
 * Returns `{ isLoaded, loadError, hasKey }`. When no key is configured it
 * resolves immediately with `hasKey: false` so callers can render a fallback
 * instead of a broken map.
 */
export function useGoogleMaps() {
  const hasKey = hasGoogleMapsKey();

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries: GOOGLE_MAPS_LIBRARIES,
    // Skip the network request entirely when there is nothing to authenticate with.
    preventGoogleFontsLoading: true,
  });

  if (!hasKey) {
    return { isLoaded: false, loadError: null, hasKey: false };
  }
  return { isLoaded, loadError, hasKey: true };
}

/** Dark map styling shared by the citizen and command-centre maps. */
export const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }],
  },
];

/** Dhaka — a sensible default when the browser gives us no position. */
export const DEFAULT_CENTER = { lat: 23.8103, lng: 90.4125 };
