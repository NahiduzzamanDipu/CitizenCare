import { Router } from 'express';
import { query } from 'express-validator';
import { CrimeReport } from '../models/CrimeReport.js';
import { EmergencyAlert } from '../models/EmergencyAlert.js';
import { CctvEvent } from '../models/CctvEvent.js';
import { User } from '../models/User.js';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

router.get(
  '/summary',
  authenticate,
  requireStaff,
  [query('days').optional().isInt({ min: 1, max: 365 })],
  validate,
  async (req, res) => {
    const days = Number(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalReports,
      pendingReports,
      approvedReports,
      resolvedReports,
      totalUsers,
      totalAlerts,
      activeAlerts,
      weaponEvents,
    ] = await Promise.all([
      CrimeReport.countDocuments(),
      CrimeReport.countDocuments({ status: 'pending' }),
      CrimeReport.countDocuments({ status: 'verified' }),
      CrimeReport.countDocuments({ status: 'resolved' }),
      User.countDocuments(),
      EmergencyAlert.countDocuments(),
      EmergencyAlert.countDocuments({ status: 'active' }),
      CctvEvent.countDocuments({ weaponDetected: true }),
    ]);

    const [byType, byStatus, reportsOverTime, topLocations] = await Promise.all([
      CrimeReport.aggregate([
        { $group: { _id: '$crimeType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      CrimeReport.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      CrimeReport.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      CrimeReport.aggregate([
        { $match: { 'location.address': { $nin: ['', null] } } },
        { $group: { _id: '$location.address', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    return res.json({
      days,
      totalReports,
      pendingReports,
      approvedReports,
      resolvedReports,
      totalUsers,
      totalAlerts,
      activeAlerts,
      weaponEvents,
      byType: byType.map((x) => ({ crimeType: x._id, count: x.count })),
      byStatus: byStatus.map((x) => ({ status: x._id, count: x.count })),
      reportsOverTime: reportsOverTime.map((x) => ({ date: x._id, count: x.count })),
      topLocations: topLocations.map((x) => ({ address: x._id, count: x.count })),
    });
  }
);

export default router;
