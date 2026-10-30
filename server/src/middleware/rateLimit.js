import rateLimit from 'express-rate-limit';

const disabled = process.env.DISABLE_RATE_LIMIT === 'true';

function build(options) {
  if (disabled) return (_req, _res, next) => next();
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down and try again.' },
    ...options,
  });
}

/** Login / registration / password change — the brute-force surface. */
export const authLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AUTH) || 20,
  skipSuccessfulRequests: true,
});

/** Everything else under /api. */
export const apiLimiter = build({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_API) || 300,
});

/**
 * CCTV streams one frame per second per camera, so they need far more headroom
 * than ordinary API traffic.
 */
export const frameLimiter = build({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_FRAMES) || 240,
});
