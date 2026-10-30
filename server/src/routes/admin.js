import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { User, ROLES } from '../models/User.js';
import { PoliceStation } from '../models/PoliceStation.js';
import { CrimeReport } from '../models/CrimeReport.js';
import { EmergencyAlert } from '../models/EmergencyAlert.js';
import { CctvEvent } from '../models/CctvEvent.js';
import { Notification } from '../models/Notification.js';
import { AuditLog, recordAudit } from '../models/AuditLog.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

router.use(authenticate, requireAdmin);

/** Escapes user input before it is used inside a RegExp search. */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---------------------------------------------------------------- overview */

router.get('/overview', async (_req, res) => {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    citizens,
    officers,
    admins,
    inactiveUsers,
    newUsers30d,
    totalReports,
    pendingReports,
    verifiedReports,
    fakeReports,
    resolvedReports,
    totalAlerts,
    activeAlerts,
    totalStations,
    activeStations,
    weaponEvents,
    weaponEvents24h,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'citizen' }),
    User.countDocuments({ role: 'police' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ isActive: false }),
    User.countDocuments({ createdAt: { $gte: since30 } }),
    CrimeReport.countDocuments(),
    CrimeReport.countDocuments({ status: 'pending' }),
    CrimeReport.countDocuments({ status: 'verified' }),
    CrimeReport.countDocuments({ status: 'fake' }),
    CrimeReport.countDocuments({ status: 'resolved' }),
    EmergencyAlert.countDocuments(),
    EmergencyAlert.countDocuments({ status: 'active' }),
    PoliceStation.countDocuments(),
    PoliceStation.countDocuments({ isActive: true }),
    CctvEvent.countDocuments({ weaponDetected: true }),
    CctvEvent.countDocuments({ weaponDetected: true, createdAt: { $gte: since24h } }),
  ]);

  const signupsOverTime = await User.aggregate([
    { $match: { createdAt: { $gte: since30 } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const reportsByStatus = await CrimeReport.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  return res.json({
    users: {
      total: totalUsers,
      citizens,
      officers,
      admins,
      inactive: inactiveUsers,
      new30d: newUsers30d,
    },
    reports: {
      total: totalReports,
      pending: pendingReports,
      verified: verifiedReports,
      fake: fakeReports,
      resolved: resolvedReports,
      byStatus: reportsByStatus.map((r) => ({ status: r._id, count: r.count })),
    },
    alerts: { total: totalAlerts, active: activeAlerts },
    stations: { total: totalStations, active: activeStations },
    cctv: { weaponEvents, weaponEvents24h },
    signupsOverTime: signupsOverTime.map((s) => ({ date: s._id, count: s.count })),
  });
});

/* ------------------------------------------------------------------- users */

router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(ROLES),
    query('status').optional().isIn(['active', 'inactive']),
    query('q').optional().trim().isLength({ max: 120 }),
  ],
  validate,
  async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.isActive = req.query.status === 'active';
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { badgeId: rx }];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .populate('station', 'name district')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  }
);

router.patch(
  '/users/:id',
  [
    param('id').isMongoId(),
    body('role').optional().isIn(ROLES),
    body('isActive').optional().isBoolean(),
    body('name').optional().trim().isLength({ min: 1, max: 120 }),
    body('phone').optional({ values: 'null' }).trim().isLength({ max: 30 }),
    body('badgeId').optional({ values: 'null' }).trim().isLength({ max: 40 }),
    body('stationId').optional({ values: 'null' }).isMongoId(),
  ],
  validate,
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isSelf = String(user._id) === req.user.id;
    // Guard against an admin locking every administrator out of the portal.
    const losingAdmin =
      user.role === 'admin' &&
      ((req.body.role !== undefined && req.body.role !== 'admin') ||
        req.body.isActive === false);
    if (losingAdmin) {
      const remaining = await User.countDocuments({
        role: 'admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (remaining === 0) {
        return res.status(409).json({
          message: 'This is the last active admin. Promote another admin first.',
        });
      }
    }
    if (isSelf && req.body.isActive === false) {
      return res
        .status(400)
        .json({ message: 'You cannot deactivate your own account' });
    }

    for (const field of ['name', 'phone', 'badgeId', 'isActive']) {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    }
    if (req.body.stationId !== undefined) {
      user.station = req.body.stationId || null;
    }
    if (req.body.role !== undefined && req.body.role !== user.role) {
      user.role = req.body.role;
      // A citizen or admin holds no station posting.
      if (user.role !== 'police') {
        user.station = null;
        user.badgeId = '';
      }
    }
    await user.save();

    await recordAudit(req, {
      action: 'user.update',
      targetType: 'User',
      targetId: String(user._id),
      detail: `${user.email} role=${user.role} active=${user.isActive}`,
    });

    return res.json(user);
  }
);

router.post(
  '/users/:id/reset-password',
  [param('id').isMongoId(), body('newPassword').isLength({ min: 8, max: 128 })],
  validate,
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.passwordHash = await User.hashPassword(req.body.newPassword);
    await user.save();

    await recordAudit(req, {
      action: 'user.resetPassword',
      targetType: 'User',
      targetId: String(user._id),
      detail: user.email,
    });

    return res.json({ message: 'Password reset' });
  }
);

/** Hard delete, with the user's notifications. Reports are kept for the record. */
router.delete(
  '/users/:id',
  [param('id').isMongoId()],
  validate,
  async (req, res) => {
    if (req.params.id === req.user.id) {
      return res
        .status(400)
        .json({ message: 'You cannot delete your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin') {
      const remaining = await User.countDocuments({
        role: 'admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (remaining === 0) {
        return res.status(409).json({ message: 'Cannot delete the last admin' });
      }
    }

    await Notification.deleteMany({ user: user._id });
    await user.deleteOne();

    await recordAudit(req, {
      action: 'user.delete',
      targetType: 'User',
      targetId: String(req.params.id),
      detail: user.email,
    });

    return res.json({ message: 'User deleted' });
  }
);

/* --------------------------------------------------------------- audit log */

router.get(
  '/audit',
  [query('limit').optional().isInt({ min: 1, max: 200 })],
  validate,
  async (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const items = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    return res.json(items);
  }
);

/* -------------------------------------------------------- broadcast notice */

router.post(
  '/broadcast',
  [
    body('title').trim().notEmpty().isLength({ max: 160 }),
    body('body').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
    body('audience').optional().isIn(['all', 'citizen', 'police']),
  ],
  validate,
  async (req, res) => {
    const audience = req.body.audience || 'all';
    const filter = { isActive: true };
    if (audience !== 'all') filter.role = audience;

    const recipients = await User.find(filter).select('_id').lean();
    if (recipients.length) {
      await Notification.insertMany(
        recipients.map((u) => ({
          user: u._id,
          title: req.body.title,
          body: req.body.body || '',
          type: 'system',
        }))
      );
    }

    const io = req.app.get('io');
    if (io) {
      const payload = {
        type: 'system',
        title: req.body.title,
        body: req.body.body || '',
      };
      if (audience === 'all') io.emit('notification', payload);
      else if (audience === 'police') io.to('staff').emit('notification', payload);
      else {
        for (const u of recipients) {
          io.to(`user:${u._id}`).emit('notification', payload);
        }
      }
    }

    await recordAudit(req, {
      action: 'broadcast',
      targetType: 'Notification',
      detail: `${audience}: ${req.body.title}`,
    });

    return res.status(201).json({ sent: recipients.length, audience });
  }
);

export default router;
