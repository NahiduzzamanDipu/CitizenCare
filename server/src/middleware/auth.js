import jwt from 'jsonwebtoken';
import { User, STAFF_ROLES } from '../models/User.js';

function readToken(req) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Verifies the JWT and loads the account from the database.
 *
 * The token carries a role snapshot, but the database is the source of truth:
 * loading the user on every request means a demoted or deactivated account
 * loses access immediately instead of when its token happens to expire.
 */
export async function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  try {
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Account not found or disabled' });
    }
    req.user = { id: user._id.toString(), role: user.role };
    req.dbUser = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Like `authenticate` but never rejects — used by endpoints that return more
 * detail to signed-in staff than to the public.
 */
export async function optionalAuthenticate(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (user?.isActive) {
      req.user = { id: user._id.toString(), role: user.role };
      req.dbUser = user;
    }
  } catch {
    // A bad token here just means the caller is treated as anonymous.
  }
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

/** Police *or* admin — anyone who staffs the command centre. */
export const requireStaff = requireRole(...STAFF_ROLES);

/** Admin only — user management, stations, audit log. */
export const requireAdmin = requireRole('admin');

/**
 * Kept for call sites that read `req.dbUser`; `authenticate` already loads it,
 * so this is now a no-op passthrough.
 */
export function loadUser(_req, _res, next) {
  next();
}
