import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { EmergencyAlert } from '../models/EmergencyAlert.js';
import { Notification } from '../models/Notification.js';
import { User, STAFF_ROLES } from '../models/User.js';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

router.post(
  '/',
  authenticate,
  [
    body('message').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('lat').isFloat({ min: -90, max: 90 }),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const { message, lng, lat, address } = req.body;
    const alert = await EmergencyAlert.create({
      user: req.dbUser._id,
      message: message || 'Emergency SOS',
      location: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
        address: address || '',
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('staff').emit('emergency', {
        id: alert._id,
        message: alert.message,
        location: alert.location,
        user: {
          id: req.dbUser._id,
          name: req.dbUser.name,
          email: req.dbUser.email,
          phone: req.dbUser.phone,
        },
        createdAt: alert.createdAt,
      });
      io.to('staff').emit('notification', {
        type: 'emergency',
        title: 'Emergency SOS',
        body: `${req.dbUser.name}: ${alert.message}`,
        alertId: alert._id,
      });
    }

    const staff = await User.find({
      role: { $in: STAFF_ROLES },
      isActive: true,
    })
      .select('_id')
      .lean();

    if (staff.length) {
      await Notification.insertMany(
        staff.map((u) => ({
          user: u._id,
          title: 'Emergency SOS',
          body: `${req.dbUser.name} - ${alert.message}`,
          type: 'emergency',
          meta: { alertId: alert._id },
        }))
      );
    }

    return res.status(201).json(alert);
  }
);

/** The reporter's own SOS history. */
router.get('/mine', authenticate, async (req, res) => {
  const list = await EmergencyAlert.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return res.json(list);
});

router.get(
  '/',
  authenticate,
  requireStaff,
  [
    query('status').optional().isIn(['active', 'acknowledged', 'resolved']),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validate,
  async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const list = await EmergencyAlert.find(filter)
      .populate('user', 'name email phone')
      .populate('acknowledgedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 200)
      .lean();
    return res.json(list);
  }
);

function transition(nextStatus) {
  return async (req, res) => {
    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Not found' });
    alert.status = nextStatus;
    alert.acknowledgedBy = req.user.id;
    alert.acknowledgedAt = new Date();
    await alert.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${alert.user}`).emit('notification', {
        type: 'emergency',
        title: `SOS ${nextStatus}`,
        body:
          nextStatus === 'resolved'
            ? 'Your emergency alert has been resolved.'
            : 'An officer has acknowledged your emergency alert.',
        alertId: alert._id,
      });
      io.to('staff').emit('emergency-updated', {
        id: alert._id,
        status: alert.status,
      });
    }

    await Notification.create({
      user: alert.user,
      title: `SOS ${nextStatus}`,
      body: `Your emergency alert was ${nextStatus}.`,
      type: 'emergency',
      meta: { alertId: alert._id },
    });

    return res.json(alert);
  };
}

router.patch(
  '/:id/acknowledge',
  authenticate,
  requireStaff,
  [param('id').isMongoId()],
  validate,
  transition('acknowledged')
);

router.patch(
  '/:id/resolve',
  authenticate,
  requireStaff,
  [param('id').isMongoId()],
  validate,
  transition('resolved')
);

export default router;
