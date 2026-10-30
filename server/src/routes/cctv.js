import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { frameLimiter } from '../middleware/rateLimit.js';
import { wrapRouter } from '../utils/asyncHandler.js';
import { upload, saveLocalFile, storeBufferToCloudinary } from '../utils/upload.js';
import { CctvEvent } from '../models/CctvEvent.js';
import { Notification } from '../models/Notification.js';

const router = wrapRouter(Router());

const PYTHON_URL = () => process.env.PYTHON_AI_URL || 'http://127.0.0.1:5050';

/** Live camera bookkeeping is in-memory and must not grow without bound. */
const MAX_TRACKED_CAMERAS = Number(process.env.CCTV_MAX_CAMERAS) || 64;
const CAMERA_TTL_MS = Number(process.env.CCTV_CAMERA_TTL_MS) || 5 * 60 * 1000;

const lastSnapshotAtByCamera = new Map();
const lastStatusByCamera = new Map();
const lastLivePushAtByCamera = new Map();

/**
 * Drops cameras that stopped streaming, then trims the oldest if the map is
 * still over capacity. Without this a long-running server accumulates one entry
 * per camera id ever seen.
 */
function pruneCameraState() {
  const cutoff = Date.now() - CAMERA_TTL_MS;
  for (const [id, status] of lastStatusByCamera) {
    if ((status?.lastSeen || 0) < cutoff) {
      lastStatusByCamera.delete(id);
      lastSnapshotAtByCamera.delete(id);
      lastLivePushAtByCamera.delete(id);
    }
  }
  if (lastStatusByCamera.size > MAX_TRACKED_CAMERAS) {
    const stale = [...lastStatusByCamera.entries()]
      .sort((a, b) => (a[1]?.lastSeen || 0) - (b[1]?.lastSeen || 0))
      .slice(0, lastStatusByCamera.size - MAX_TRACKED_CAMERAS);
    for (const [id] of stale) {
      lastStatusByCamera.delete(id);
      lastSnapshotAtByCamera.delete(id);
      lastLivePushAtByCamera.delete(id);
    }
  }
}

function logAiSummary({ cameraId, place, weaponDetected, labels, detections, aiUnavailable }) {
  const dets = Array.isArray(detections) ? detections : [];
  if (!dets.length) {
    console.log(
      `[CCTV][AI] camera=${cameraId} place=${place || '-'} weapon=${
        weaponDetected ? 'Y' : 'N'
      } aiUnavailable=${aiUnavailable ? 'Y' : 'N'} No objects detected`
    );
    return;
  }
  const summary = dets
    .slice(0, 18)
    .map((d) => `${d?.label ?? 'unknown'}=${Number(d?.confidence ?? 0).toFixed(2)}`)
    .join('; ');
  console.log(
    `[CCTV][AI] camera=${cameraId} place=${place || '-'} weapon=${
      weaponDetected ? 'Y' : 'N'
    } labels=${(labels || []).join(',') || '-'} dets=${summary}`
  );
}

/**
 * Forwards a frame to the Python YOLOv8 service.
 *
 * Uses the built-in WHATWG FormData (Node 18+) with Blob — the legacy
 * `form-data` package does not serialize correctly through global fetch and
 * Flask then sees an empty `request.files`.
 */
async function forwardToPython(buffer, originalname, mimetype, endpoint = '/detect', overrides = {}) {
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], { type: mimetype || 'image/jpeg' }),
    originalname || 'frame.jpg'
  );

  const base = PYTHON_URL().replace(/\/+$/, '');
  const url = new URL(base.endsWith(endpoint) ? base : `${base}${endpoint}`);
  // Tuning without restarting the Python service. Lower conf helps small or
  // blurred weapons; 0.10-0.15 is a good debugging range.
  url.searchParams.set(
    'conf',
    String(overrides.conf || process.env.CCTV_CONF_THRESHOLD || '0.10')
  );
  url.searchParams.set(
    'imgsz',
    String(overrides.imgsz || process.env.CCTV_IMGSZ || '640')
  );

  const res = await fetch(url, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(Number(process.env.PYTHON_AI_TIMEOUT_MS) || 30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Python AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function maybeSaveSnapshot(req, buffer, ext) {
  if (req.app.get('cloudinaryEnabled')) {
    const r = await storeBufferToCloudinary(buffer, 'cctv', 'image');
    return r.secure_url;
  }
  return saveLocalFile(buffer, `frame${ext || '.jpg'}`);
}

/**
 * POST /api/cctv/upload-frame
 * Multipart field: `frame` (image/jpeg). Optional fields: cameraId, place,
 * lat, lng, address.
 */
router.post(
  '/upload-frame',
  authenticate,
  frameLimiter,
  upload.single('frame'),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'frame file required (field name: frame)' });
    }

    let ai;
    let aiUnavailable = false;
    try {
      ai = await forwardToPython(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    } catch (e) {
      // Keep the live view working even when the Python service is down.
      aiUnavailable = true;
      ai = {
        weaponDetected: false,
        weaponLabels: [],
        detections: [],
        message:
          'AI service unavailable. Start the Python server (ai-model) and set PYTHON_AI_URL.',
        detail: e?.message,
      };
    }

    const lat = req.body.lat ? Number(req.body.lat) : undefined;
    const lng = req.body.lng ? Number(req.body.lng) : undefined;
    const address = req.body.address ? String(req.body.address).slice(0, 500) : '';
    const cameraId = req.body.cameraId
      ? String(req.body.cameraId).slice(0, 32)
      : 'CAM-01';
    const place = req.body.place ? String(req.body.place).slice(0, 80) : '';

    const weaponDetected = Boolean(ai.weaponDetected);
    const detections = Array.isArray(ai.detections) ? ai.detections : [];
    const labels = Array.isArray(ai.weaponLabels) ? ai.weaponLabels : [];

    logAiSummary({ cameraId, place, weaponDetected, labels, detections, aiUnavailable });

    const io = req.app.get('io');

    // Low-latency preview frame over the socket. Deliberately not written to
    // disk — only the throttled snapshot below is persisted.
    const livePushEveryMs = Number(process.env.CCTV_LIVE_PUSH_MS) || 450;
    const lastPush = lastLivePushAtByCamera.get(cameraId) || 0;
    if (io && Date.now() - lastPush >= livePushEveryMs) {
      if (req.file.buffer.length <= 450 * 1024) {
        io.to('staff').emit('cctv-frame', {
          type: 'cctv-frame',
          cameraId,
          place,
          userId: req.dbUser._id,
          userName: req.dbUser.name,
          weaponDetected,
          labels,
          detections,
          imageData: req.file.buffer.toString('base64'),
          createdAt: new Date().toISOString(),
        });
        lastLivePushAtByCamera.set(cameraId, Date.now());
      }
    }

    // Throttled snapshot so staff can see recent footage after a refresh; a
    // detection always saves one.
    let imageUrl = '';
    const snapshotEveryMs = Number(process.env.CCTV_STATUS_SNAPSHOT_MS) || 800;
    const last = lastSnapshotAtByCamera.get(cameraId) || 0;
    if (weaponDetected || Date.now() - last >= snapshotEveryMs) {
      try {
        imageUrl = await maybeSaveSnapshot(req, req.file.buffer, '.jpg');
        lastSnapshotAtByCamera.set(cameraId, Date.now());
      } catch (err) {
        console.error('CCTV snapshot save failed', err);
      }
    }

    const prevStatus = lastStatusByCamera.get(cameraId);
    const statusPayload = {
      type: 'cctv-status',
      cameraId,
      place,
      userId: req.dbUser._id,
      userName: req.dbUser.name,
      weaponDetected,
      labels,
      detections,
      imageUrl: imageUrl || prevStatus?.imageUrl || '',
      frameWidth: ai.frameWidth,
      frameHeight: ai.frameHeight,
      location: {
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        address,
      },
      createdAt: new Date().toISOString(),
    };
    lastStatusByCamera.set(cameraId, { ...statusPayload, lastSeen: Date.now() });
    pruneCameraState();
    if (io) io.to('staff').emit('cctv-status', statusPayload);

    if (weaponDetected) {
      const doc = await CctvEvent.create({
        user: req.dbUser._id,
        cameraId,
        place,
        weaponDetected: true,
        labels: labels.slice(0, 20),
        detections: detections.slice(0, 50),
        imageUrl,
        frameWidth: ai.frameWidth,
        frameHeight: ai.frameHeight,
        location: {
          lat: Number.isFinite(lat) ? lat : undefined,
          lng: Number.isFinite(lng) ? lng : undefined,
          address,
        },
      });

      const payload = {
        type: 'cctv-weapon',
        title: 'Weapon / suspicious object detected',
        body: `${req.dbUser.name}: ${labels.join(', ') || 'see detections'}`,
        eventId: doc._id,
        userId: req.dbUser._id,
        userName: req.dbUser.name,
        cameraId,
        place,
        labels,
        detections,
        imageUrl,
        frameWidth: ai.frameWidth,
        frameHeight: ai.frameHeight,
        location: doc.location,
        createdAt: doc.createdAt,
      };

      if (io) {
        io.to('staff').emit('cctv-alert', payload);
        io.to(`user:${req.dbUser._id}`).emit('cctv-alert', payload);
        io.emit('public-safety', {
          type: 'cctv',
          cameraId,
          place,
          location: payload.location,
          createdAt: payload.createdAt,
        });
      }

      await Notification.create({
        user: req.dbUser._id,
        title: payload.title,
        body: payload.body,
        type: 'system',
        meta: { cctvEventId: doc._id, labels },
      });
    }

    return res.json({
      weaponDetected,
      labels,
      detections,
      frameWidth: ai.frameWidth,
      frameHeight: ai.frameHeight,
      aiUnavailable,
      message: ai.message,
      detail: ai.detail,
      detectedClasses: Array.isArray(ai.detectedClasses)
        ? ai.detectedClasses
        : undefined,
      frameQuality: ai.frameQuality,
      inference: ai.inference,
    });
  }
);

/** Upload a static image (field: `image`) and see the model's full debug output. */
router.post(
  '/detect-test',
  authenticate,
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'image file required (field name: image)' });
    }
    try {
      const data = await forwardToPython(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        '/detect/test',
        { conf: req.query.conf, imgsz: req.query.imgsz }
      );
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ message: 'AI test failed', detail: e?.message });
    }
  }
);

/** Recent weapon detections with coordinates, for the staff map. */
router.get(
  '/map',
  authenticate,
  requireStaff,
  [query('limit').optional().isInt({ min: 1, max: 500 })],
  validate,
  async (req, res) => {
    const items = await CctvEvent.find({
      weaponDetected: true,
      'location.lat': { $ne: null },
      'location.lng': { $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 200)
      .lean();
    return res.json(items);
  }
);

/** Anonymised public feed for the citizen safety map. */
router.get(
  '/public-map',
  [query('limit').optional().isInt({ min: 1, max: 300 })],
  validate,
  async (req, res) => {
    const items = await CctvEvent.find({
      weaponDetected: true,
      'location.lat': { $ne: null },
      'location.lng': { $ne: null },
    })
      .select('cameraId place labels location createdAt')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 120)
      .lean();
    return res.json(items);
  }
);

router.get('/status', authenticate, requireStaff, async (_req, res) => {
  pruneCameraState();
  const items = [...lastStatusByCamera.values()]
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
    .slice(0, 24);
  return res.json({ items });
});

router.get(
  '/events',
  authenticate,
  requireStaff,
  [query('limit').optional().isInt({ min: 1, max: 200 })],
  validate,
  async (req, res) => {
    const items = await CctvEvent.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 50)
      .lean();
    return res.json(items);
  }
);

router.get(
  '/my-events',
  authenticate,
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  async (req, res) => {
    const items = await CctvEvent.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 30)
      .lean();
    return res.json(items);
  }
);

/** Proxied health check so the UI can tell "AI is down" from "no detections". */
router.get('/ai-health', authenticate, requireStaff, async (_req, res) => {
  try {
    const base = PYTHON_URL().replace(/\/+$/, '');
    const r = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      return res.status(502).json({ ok: false, message: `AI service HTTP ${r.status}` });
    }
    return res.json(await r.json());
  } catch (e) {
    return res.status(502).json({ ok: false, message: e?.message || 'AI service unreachable' });
  }
});

export default router;
