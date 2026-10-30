import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { CrimeReport } from '../models/CrimeReport.js';
import { Notification } from '../models/Notification.js';
import { recordAudit } from '../models/AuditLog.js';
import {
  authenticate,
  optionalAuthenticate,
  requireStaff,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';
import {
  upload,
  storeBufferToCloudinary,
  saveLocalFile,
} from '../utils/upload.js';

const router = wrapRouter(Router());

export const CRIME_TYPES = [
  'theft',
  'assault',
  'vandalism',
  'traffic',
  'domestic',
  'drugs',
  'other',
];

export const REPORT_STATUSES = ['pending', 'verified', 'fake', 'resolved'];

async function persistMedia(files, cloudEnabled) {
  const media = [];
  for (const f of files || []) {
    const isVideo = f.mimetype.startsWith('video');
    const type = isVideo ? 'video' : 'image';
    let url;
    if (cloudEnabled) {
      const res = await storeBufferToCloudinary(
        f.buffer,
        'reports',
        isVideo ? 'video' : 'image'
      );
      url = res.secure_url;
    } else {
      url = await saveLocalFile(f.buffer, f.originalname);
    }
    media.push({ url, type });
  }
  return media;
}

router.post(
  '/',
  authenticate,
  upload.array('media', 5),
  [
    body('title').trim().notEmpty().isLength({ max: 200 }),
    body('description').trim().notEmpty().isLength({ max: 8000 }),
    body('crimeType').isIn(CRIME_TYPES),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('lat').isFloat({ min: -90, max: 90 }),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const { title, description, crimeType, lng, lat, address } = req.body;
    const media = await persistMedia(req.files, req.app.get('cloudinaryEnabled'));
    const report = await CrimeReport.create({
      title,
      description,
      crimeType,
      location: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
        address: address || '',
      },
      media,
      submittedBy: req.dbUser._id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to('staff').emit('notification', {
        type: 'report',
        title: 'New crime report',
        body: title,
        reportId: report._id,
      });
    }

    await Notification.create({
      title: 'Report submitted',
      body: `Your report "${title}" is pending review.`,
      type: 'report',
      user: req.dbUser._id,
      meta: { reportId: report._id },
    });

    return res.status(201).json(report);
  }
);

/**
 * Public map feed. Anonymous callers only ever see verified reports; staff may
 * request any status.
 */
router.get(
  '/map',
  optionalAuthenticate,
  [
    query('crimeType').optional().isIn(CRIME_TYPES),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(REPORT_STATUSES),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validate,
  async (req, res) => {
    const isStaff = ['police', 'admin'].includes(req.user?.role);
    const filter = {};
    if (req.query.crimeType) filter.crimeType = req.query.crimeType;
    filter.status = isStaff && req.query.status ? req.query.status : 'verified';
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const query$ = CrimeReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 500);

    // Reporter identity is staff-only; the public feed stays anonymous.
    if (isStaff) query$.populate('submittedBy', 'name email');
    else query$.select('title crimeType location status createdAt media');

    return res.json(await query$.lean());
  }
);

router.get('/mine', authenticate, async (req, res) => {
  const list = await CrimeReport.find({ submittedBy: req.user.id })
    .sort({ createdAt: -1 })
    .lean();
  return res.json(list);
});

/** Staff listing with filters and pagination. */
router.get(
  '/',
  authenticate,
  requireStaff,
  [
    query('crimeType').optional().isIn(CRIME_TYPES),
    query('status').optional().isIn(REPORT_STATUSES),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = {};
    if (req.query.crimeType) filter.crimeType = req.query.crimeType;
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      CrimeReport.find(filter)
        .populate('submittedBy', 'name email')
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CrimeReport.countDocuments(filter),
    ]);
    return res.json({ items, total, page, limit });
  }
);

/**
 * A single report. Staff see everything; a citizen sees their own report or a
 * verified one — an unreviewed report must not be readable by its subject.
 */
router.get(
  '/:id',
  optionalAuthenticate,
  [param('id').isMongoId()],
  validate,
  async (req, res) => {
    const report = await CrimeReport.findById(req.params.id)
      .populate('submittedBy', 'name email')
      .lean();
    if (!report) return res.status(404).json({ message: 'Not found' });

    const isStaff = ['police', 'admin'].includes(req.user?.role);
    const isOwner = String(report.submittedBy?._id) === req.user?.id;
    if (!isStaff && !isOwner && report.status !== 'verified') {
      return res.status(404).json({ message: 'Not found' });
    }
    if (!isStaff && !isOwner) delete report.submittedBy;

    return res.json(report);
  }
);

router.patch(
  '/:id/status',
  authenticate,
  requireStaff,
  [
    param('id').isMongoId(),
    body('status').isIn(REPORT_STATUSES),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  ],
  validate,
  async (req, res) => {
    const report = await CrimeReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Not found' });
    report.status = req.body.status;
    report.reviewedBy = req.user.id;
    report.reviewedAt = new Date();
    if (req.body.note) report.note = req.body.note;
    await report.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${report.submittedBy}`).emit('notification', {
        type: 'report',
        title: `Report ${req.body.status}`,
        body: report.title,
        reportId: report._id,
      });
      // Public safety signal: a newly verified report lets citizen maps refresh.
      if (req.body.status === 'verified') {
        io.emit('public-safety', {
          type: 'report',
          status: 'verified',
          reportId: report._id,
          location: report.location,
          createdAt: report.reviewedAt.toISOString(),
        });
      }
    }

    await Notification.create({
      user: report.submittedBy,
      title: `Report ${req.body.status}`,
      body: `Your report "${report.title}" was ${req.body.status}.`,
      type: 'report',
      meta: { reportId: report._id },
    });

    await recordAudit(req, {
      action: 'report.status',
      targetType: 'CrimeReport',
      targetId: String(report._id),
      detail: `${report.title} -> ${req.body.status}`,
    });

    return res.json(report);
  }
);

export default router;
