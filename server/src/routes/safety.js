import { Router } from 'express';
import { query } from 'express-validator';
import { CrimeReport } from '../models/CrimeReport.js';
import { CctvEvent } from '../models/CctvEvent.js';
import { validate } from '../middleware/validate.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Risk score for a point: verified crime reports weigh 2, CCTV weapon
 * detections weigh 3 (a live detection is a stronger signal than a filed
 * report), and anything older than `days` is ignored.
 */
router.get(
  '/safety-status',
  [
    query('lat').isFloat({ min: -90, max: 90 }),
    query('lng').isFloat({ min: -180, max: 180 }),
    query('radiusM').optional().isInt({ min: 100, max: 5000 }),
    query('days').optional().isInt({ min: 1, max: 60 }),
  ],
  validate,
  async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusM = Number(req.query.radiusM) || 1000;
    const days = Number(req.query.days) || 14;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // $centerSphere takes its radius in radians of the earth's sphere.
    const radians = radiusM / 6378137;

    const crimeFilter = {
      status: 'verified',
      createdAt: { $gte: since },
      location: { $geoWithin: { $centerSphere: [[lng, lat], radians] } },
    };

    // CctvEvent stores plain lat/lng rather than GeoJSON, so narrow with a
    // bounding box in the query and refine with haversine in memory.
    const latDelta = radiusM / 111320;
    const lngDelta =
      radiusM / (111320 * Math.max(0.15, Math.cos((lat * Math.PI) / 180)));

    const [crimeCount, weaponCandidates, recentTypes] = await Promise.all([
      CrimeReport.countDocuments(crimeFilter),
      CctvEvent.find({
        weaponDetected: true,
        createdAt: { $gte: since },
        'location.lat': { $gte: lat - latDelta, $lte: lat + latDelta },
        'location.lng': { $gte: lng - lngDelta, $lte: lng + lngDelta },
      })
        .select('location createdAt labels cameraId place')
        .limit(1500)
        .lean(),
      CrimeReport.aggregate([
        { $match: crimeFilter },
        { $group: { _id: '$crimeType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
      ]),
    ]);

    const weaponCount = weaponCandidates.filter((e) => {
      const { lat: elat, lng: elng } = e?.location || {};
      if (typeof elat !== 'number' || typeof elng !== 'number') return false;
      return haversineMeters(lat, lng, elat, elng) <= radiusM;
    }).length;

    const score = crimeCount * 2 + weaponCount * 3;
    let status = 'SAFE';
    if (score >= 5) status = 'HIGH RISK';
    else if (score > 0) status = 'LOW RISK';

    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour <= 5;
    const nightNote =
      isNight && status !== 'SAFE' ? 'Risk increases at night.' : '';

    return res.json({
      status,
      score,
      nearbyIncidents: crimeCount + weaponCount,
      breakdown: {
        recentCrimes: crimeCount,
        weaponDetections: weaponCount,
        days,
        radiusM,
      },
      topCrimeTypes: recentTypes.map((t) => ({ crimeType: t._id, count: t.count })),
      note:
        crimeCount + weaponCount === 0
          ? 'No recent incidents recorded nearby. Stay cautious.'
          : nightNote || 'Based on recent activity.',
    });
  }
);

export default router;
