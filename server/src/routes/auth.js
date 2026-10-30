import { Router } from 'express';
import { body } from 'express-validator';
import { User } from '../models/User.js';
import { PoliceStation } from '../models/PoliceStation.js';
import { signToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    badgeId: user.badgeId,
    station: user.station,
  };
}

async function issue(res, user, status = 200) {
  const token = signToken(user);
  return res.status(status).json({ token, user: publicUser(user) });
}

/**
 * Public citizen signup. `role` is deliberately not read from the body — the
 * only way to obtain the police role is POST /register/police with a valid
 * station code, and the only way to obtain admin is an existing admin
 * promoting the account.
 */
router.post(
  '/register',
  authLimiter,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Please enter your name')
      .isLength({ max: 120 }),
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be at least 8 characters'),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  ],
  validate,
  async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
      role: 'citizen',
      phone: phone || '',
    });
    return issue(res, user, 201);
  }
);

/**
 * Police signup. Requires the station's registration code, which an admin
 * issues from the admin portal. Codes are compared case-insensitively.
 */
router.post(
  '/register/police',
  authLimiter,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Please enter your name')
      .isLength({ max: 120 }),
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be at least 8 characters'),
    body('stationCode')
      .trim()
      .notEmpty()
      .withMessage('A station registration code is required')
      .isLength({ min: 6, max: 32 })
      .withMessage('That does not look like a valid station code'),
    body('badgeId').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  ],
  validate,
  async (req, res) => {
    const { name, email, password, stationCode, badgeId, phone } = req.body;

    const station = await PoliceStation.findOne({
      code: String(stationCode).trim().toUpperCase(),
    }).select('+code');

    if (!station || !station.isActive) {
      return res.status(403).json({
        message: 'Invalid or inactive police station code.',
      });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
      role: 'police',
      phone: phone || '',
      badgeId: badgeId || '',
      station: station._id,
    });
    return issue(res, user, 201);
  }
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Enter your password'),
  ],
  validate,
  async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    // Same message for unknown email and wrong password: don't leak which
    // addresses are registered.
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is disabled' });
    }
    user.lastLoginAt = new Date();
    await user.save();
    return issue(res, user);
  }
);

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id).populate(
    'station',
    'name district'
  );
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(user);
});

router.patch(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 120 }),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  ],
  validate,
  async (req, res) => {
    const user = req.dbUser;
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    await user.save();
    return res.json(user);
  }
);

router.post(
  '/change-password',
  authenticate,
  authLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Enter your current password'),
    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .withMessage('New password must be at least 8 characters'),
  ],
  validate,
  async (req, res) => {
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user || !(await user.comparePassword(req.body.currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    user.passwordHash = await User.hashPassword(req.body.newPassword);
    await user.save();
    return res.json({ message: 'Password updated' });
  }
);

export default router;
