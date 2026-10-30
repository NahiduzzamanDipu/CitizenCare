import { validationResult } from 'express-validator';

/**
 * Turns express-validator results into a single 400 response so every route
 * reports validation failures in the same shape.
 */
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const list = errors.array();
  const first = list[0];
  // express-validator's default message is the unhelpful "Invalid value", so
  // fall back to naming the offending field when no custom message was set.
  const message =
    first?.msg && first.msg !== 'Invalid value'
      ? first.msg
      : `Invalid value for "${first?.path || 'request'}"`;
  return res.status(400).json({ message, errors: list });
}
