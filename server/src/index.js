import dotenv from 'dotenv';
// Shell variables win over .env, which is what hosting platforms expect: they
// inject PORT, MONGODB_URI and friends into the environment directly.
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import multer from 'multer';

import { connectDB } from './config/db.js';
import { configureCloudinary } from './config/cloudinary.js';
import { getUploadDir } from './utils/upload.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { User, STAFF_ROLES } from './models/User.js';

import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import alertRoutes from './routes/alerts.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import analyticsRoutes from './routes/analytics.js';
import aiRoutes from './routes/ai.js';
import cctvRoutes from './routes/cctv.js';
import safetyRoutes from './routes/safety.js';
import stationRoutes from './routes/stations.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ config */

/**
 * CLIENT_URL accepts a comma-separated list so a deployment can serve, say, a
 * production domain and a preview domain from one API.
 */
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  // No Origin header: same-origin requests, curl, mobile clients, health checks.
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} is not allowed by CORS`));
}

/* --------------------------------------------------------------- bootstrap */

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

app.set('io', io);
app.set('cloudinaryEnabled', configureCloudinary());
// Rate limiting and req.ip need the real client address behind a proxy.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

/* ------------------------------------------------------------------ socket */

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Unauthorized'));

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Check the account is still live rather than trusting the token's role.
    const user = await User.findById(payload.sub).select('role isActive').lean();
    if (!user || !user.isActive) return next(new Error('Unauthorized'));

    socket.userId = String(user._id);
    socket.userRole = user.role;
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  // "staff" carries operational alerts (SOS, CCTV weapon detections).
  if (STAFF_ROLES.includes(socket.userRole)) socket.join('staff');
  if (socket.userRole === 'admin') socket.join('admin');
});

/* -------------------------------------------------------------- middleware */

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use('/uploads', express.static(getUploadDir(), { maxAge: '7d' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use('/api', apiLimiter);

/* ------------------------------------------------------------------ routes */

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/cctv', cctvRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', safetyRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

/* ----------------------------------------------------------- error handler */

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large (max 25 MB).'
        : err.message;
    return res.status(400).json({ message });
  }
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.values(err.errors || {}).map((e) => e.message),
    });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }
  // Duplicate key on a unique index (e.g. two signups racing on one email).
  if (err?.code === 11000) {
    return res.status(409).json({
      message: `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ')}`,
    });
  }
  if (/not allowed by CORS/.test(err?.message || '')) {
    return res.status(403).json({ message: err.message });
  }

  console.error(err);
  return res.status(500).json({
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err?.message || 'Internal server error',
  });
});

/* ------------------------------------------------------------------ startup */

const port = Number(process.env.PORT) || 5000;

function assertConfig() {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (missing.length) {
    console.error(
      `Missing required environment variable(s): ${missing.join(', ')}\n` +
        'Copy server/.env.example to server/.env and fill them in.'
    );
    process.exit(1);
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.JWT_SECRET.length < 32
  ) {
    console.error('JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }
}

async function main() {
  assertConfig();
  await connectDB();

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${port} is already in use — another CitizenCare API (or other ` +
          'service) is running. Stop it, or set a different PORT in server/.env.'
      );
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
    console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
  });
}

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down.`);
  io.close();
  httpServer.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export { app, io };
