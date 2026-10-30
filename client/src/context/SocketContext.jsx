import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

/** Events fanned out to `lastEvent` for any component that wants them. */
const BROADCAST_EVENTS = [
  'notification',
  'emergency',
  'emergency-updated',
  'public-safety',
];

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user || !getToken()) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    // `undefined` URL makes socket.io use the page origin, which the Vite dev
    // proxy forwards to the API — that keeps dev and production identical.
    const s = io(SOCKET_URL, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => {
      setConnected(false);
      // Only worth logging once per failure kind; unauthorized means the token
      // was rejected and reconnecting will not help.
      if (err?.message === 'Unauthorized') {
        console.warn('Realtime connection rejected — please sign in again.');
        s.disconnect();
      }
    });

    for (const name of BROADCAST_EVENTS) {
      s.on(name, (payload) =>
        setLastEvent({ type: name, payload, at: Date.now() })
      );
    }

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  const value = useMemo(
    () => ({ socket, connected, lastEvent, setLastEvent }),
    [socket, connected, lastEvent]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext) || { socket: null, connected: false, lastEvent: null };
}

/**
 * Subscribes to one socket event for the lifetime of a component.
 * Keeps the handler in a ref so callers don't need to memoise it.
 */
export function useSocketEvent(eventName, handler) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket || !eventName) return undefined;
    const listener = (...args) => handlerRef.current?.(...args);
    socket.on(eventName, listener);
    return () => socket.off(eventName, listener);
  }, [socket, eventName]);
}
