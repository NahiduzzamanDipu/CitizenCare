import { Router } from 'express';
import { param, query } from 'express-validator';
import { Notification } from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

router.get(
  '/',
  authenticate,
  [query('limit').optional().isInt({ min: 1, max: 200 })],
  validate,
  async (req, res) => {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(Number(req.query.limit) || 100)
        .lean(),
      Notification.countDocuments({ user: req.user.id, read: false }),
    ]);
    // Kept as a bare array for backwards compatibility; the unread count rides
    // along in a header so the bell badge does not need a second request.
    res.set('X-Unread-Count', String(unread));
    return res.json(items);
  }
);

router.get('/unread-count', authenticate, async (req, res) => {
  const unread = await Notification.countDocuments({
    user: req.user.id,
    read: false,
  });
  return res.json({ unread });
});

router.patch(
  '/:id/read',
  authenticate,
  [param('id').isMongoId()],
  validate,
  async (req, res) => {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!n) return res.status(404).json({ message: 'Not found' });
    return res.json(n);
  }
);

router.post('/read-all', authenticate, async (req, res) => {
  const r = await Notification.updateMany(
    { user: req.user.id, read: false },
    { read: true }
  );
  return res.json({ ok: true, updated: r.modifiedCount });
});

router.delete('/', authenticate, async (req, res) => {
  const r = await Notification.deleteMany({ user: req.user.id });
  return res.json({ ok: true, deleted: r.deletedCount });
});

export default router;
