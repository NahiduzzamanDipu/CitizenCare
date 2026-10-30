import { Router } from 'express';
import { param, query } from 'express-validator';
import { User } from '../models/User.js';
import { authenticate, requireStaff, requireAdmin } from '../middleware/auth.js';
import { recordAudit } from '../models/AuditLog.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

/**
 * Staff directory. Full user administration (role changes, deletion, password
 * resets) lives under /api/admin/users and is admin-only.
 */
router.get(
  '/',
  authenticate,
  requireStaff,
  [query('limit').optional().isInt({ min: 1, max: 200 })],
  validate,
  async (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const users = await User.find()
      .populate('station', 'name district')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json(users);
  }
);

/** Soft-disable: keeps the account's history but blocks sign-in. */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isMongoId()],
  validate,
  async (req, res) => {
    if (req.params.id === req.user.id) {
      return res
        .status(400)
        .json({ message: 'You cannot deactivate your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Not found' });

    if (user.role === 'admin') {
      const remaining = await User.countDocuments({
        role: 'admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (remaining === 0) {
        return res
          .status(409)
          .json({ message: 'Cannot deactivate the last active admin' });
      }
    }

    user.isActive = false;
    await user.save();

    await recordAudit(req, {
      action: 'user.deactivate',
      targetType: 'User',
      targetId: String(user._id),
      detail: user.email,
    });

    return res.json({ message: 'User deactivated', user });
  }
);

export default router;
