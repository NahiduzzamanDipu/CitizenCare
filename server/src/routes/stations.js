import { Router } from 'express';
import { body, param, query } from 'express-validator';
import crypto from 'crypto';
import { PoliceStation } from '../models/PoliceStation.js';
import { User } from '../models/User.js';
import { recordAudit } from '../models/AuditLog.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

/** Human-friendly, unambiguous code (no O/0, I/1). */
function generateCode(prefix = 'PS') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 8; i += 1) {
    body += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `${prefix}-${body}`;
}

/**
 * Public directory used by the police signup form. Codes are never included —
 * the officer must already have been given one.
 */
router.get('/public', async (_req, res) => {
  const items = await PoliceStation.find({ isActive: true })
    .select('name district')
    .sort({ name: 1 })
    .lean();
  return res.json(items);
});

router.get(
  '/',
  authenticate,
  requireAdmin,
  [query('includeCodes').optional().isBoolean()],
  validate,
  async (req, res) => {
    const wantCodes = req.query.includeCodes === 'true';
    const q = PoliceStation.find().sort({ createdAt: -1 });
    if (wantCodes) q.select('+code');
    const stations = await q.lean();

    const counts = await User.aggregate([
      { $match: { role: 'police', station: { $ne: null } } },
      { $group: { _id: '$station', count: { $sum: 1 } } },
    ]);
    const byStation = new Map(counts.map((c) => [String(c._id), c.count]));

    return res.json(
      stations.map((s) => ({ ...s, officerCount: byStation.get(String(s._id)) || 0 }))
    );
  }
);

router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty().isLength({ max: 160 }),
    body('district').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 400 }),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
    body('lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }),
    body('lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }),
    body('code').optional({ values: 'falsy' }).trim().isLength({ min: 6, max: 32 }),
  ],
  validate,
  async (req, res) => {
    const code = (req.body.code || generateCode()).toUpperCase();
    if (await PoliceStation.exists({ code })) {
      return res.status(409).json({ message: 'That station code is already in use' });
    }
    const station = await PoliceStation.create({
      name: req.body.name,
      code,
      district: req.body.district || '',
      address: req.body.address || '',
      phone: req.body.phone || '',
      location: {
        lat: req.body.lat != null ? Number(req.body.lat) : undefined,
        lng: req.body.lng != null ? Number(req.body.lng) : undefined,
      },
      createdBy: req.user.id,
    });

    await recordAudit(req, {
      action: 'station.create',
      targetType: 'PoliceStation',
      targetId: String(station._id),
      detail: station.name,
    });

    return res.status(201).json({ ...station.toObject(), code });
  }
);

router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isMongoId(),
    body('name').optional().trim().isLength({ min: 1, max: 160 }),
    body('district').optional({ values: 'null' }).trim().isLength({ max: 120 }),
    body('address').optional({ values: 'null' }).trim().isLength({ max: 400 }),
    body('phone').optional({ values: 'null' }).trim().isLength({ max: 40 }),
    body('lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }),
    body('lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const station = await PoliceStation.findById(req.params.id);
    if (!station) return res.status(404).json({ message: 'Station not found' });

    for (const field of ['name', 'district', 'address', 'phone', 'isActive']) {
      if (req.body[field] !== undefined) station[field] = req.body[field];
    }
    if (req.body.lat !== undefined) station.location.lat = Number(req.body.lat);
    if (req.body.lng !== undefined) station.location.lng = Number(req.body.lng);
    await station.save();

    await recordAudit(req, {
      action: 'station.update',
      targetType: 'PoliceStation',
      targetId: String(station._id),
      detail: station.name,
    });

    return res.json(station);
  }
);

/** Rotating the code locks out anyone who was handed the old one. */
router.post(
  '/:id/rotate-code',
  authenticate,
  requireAdmin,
  [param('id').isMongoId()],
  validate,
  async (req, res) => {
    const station = await PoliceStation.findById(req.params.id).select('+code');
    if (!station) return res.status(404).json({ message: 'Station not found' });

    let code;
    do {
      code = generateCode();
    } while (await PoliceStation.exists({ code }));

    station.code = code;
    await station.save();

    await recordAudit(req, {
      action: 'station.rotateCode',
      targetType: 'PoliceStation',
      targetId: String(station._id),
      detail: station.name,
    });

    return res.json({ id: station._id, code });
  }
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isMongoId()],
  validate,
  async (req, res) => {
    const station = await PoliceStation.findById(req.params.id);
    if (!station) return res.status(404).json({ message: 'Station not found' });

    const officers = await User.countDocuments({ station: station._id });
    if (officers > 0) {
      return res.status(409).json({
        message: `${officers} officer account(s) belong to this station. Deactivate it instead of deleting.`,
      });
    }
    await station.deleteOne();

    await recordAudit(req, {
      action: 'station.delete',
      targetType: 'PoliceStation',
      targetId: String(req.params.id),
      detail: station.name,
    });

    return res.json({ message: 'Station deleted' });
  }
);

export default router;
