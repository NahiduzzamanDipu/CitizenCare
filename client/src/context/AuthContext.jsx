import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, getToken, setToken, onUnauthorized } from '../api/client';

const AuthContext = createContext(null);

function normalizeUser(u) {
  if (!u) return null;
  return { ...u, id: String(u.id || u._id) };
}

/** Where each role lands after signing in. */
export function homePathFor(role) {
  if (role === 'admin') return '/admin';
  if (role === 'police') return '/police/dashboard';
  return '/app';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await api.get('/api/auth/me');
      const normalized = normalizeUser(me);
      setUser(normalized);
      return normalized;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A 401 from any request means the token is dead — clear the session so the
  // UI shows the login screen instead of an endless stream of failures.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    setToken(data.token);
    setUser(normalizeUser(data.user));
    return data;
  }, []);

  const registerCitizen = useCallback(async (payload) => {
    const data = await api.post('/api/auth/register', payload);
    setToken(data.token);
    setUser(normalizeUser(data.user));
    return data;
  }, []);

  const registerPolice = useCallback(async (payload) => {
    const data = await api.post('/api/auth/register/police', payload);
    setToken(data.token);
    setUser(normalizeUser(data.user));
    return data;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const updated = await api.patch('/api/auth/me', payload);
    setUser(normalizeUser(updated));
    return updated;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isStaff: user?.role === 'police' || user?.role === 'admin',
      isAdmin: user?.role === 'admin',
      login,
      registerCitizen,
      registerPolice,
      updateProfile,
      logout,
      refresh,
    }),
    [user, loading, login, registerCitizen, registerPolice, updateProfile, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
