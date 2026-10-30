const BASE = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'citizencare.token';
// Migrate anyone still holding the old unnamespaced key.
const LEGACY_TOKEN_KEY = 'token';

export function getToken() {
  try {
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy && !localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, legacy);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private-mode browsers can throw on storage access.
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Ignore — the session simply won't survive a reload.
  }
}

/** Listeners fired when the API rejects our token, so the app can sign out. */
const unauthorizedHandlers = new Set();

export function onUnauthorized(handler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** Pulls the most useful message out of the server's error shape. */
function extractMessage(data, res) {
  if (!data) return res.statusText || 'Request failed';
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  const first = data.errors?.[0];
  if (typeof first === 'string') return first;
  if (first?.msg) return `${first.path ? `${first.path}: ` : ''}${first.msg}`;
  return res.statusText || 'Request failed';
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Is the API running on port 5000?',
      0,
      null
    );
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    // An expired or revoked token should drop the session, not loop forever.
    if (res.status === 401 && token) {
      setToken(null);
      for (const h of unauthorizedHandlers) h();
    }
    throw new ApiError(extractMessage(data, res), res.status, data);
  }

  return data;
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: (path, body) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: (path, body) =>
    request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

/** Builds a query string, dropping empty values. */
export function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function mediaUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return `${BASE}${url}`;
}
