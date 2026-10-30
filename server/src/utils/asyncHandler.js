/**
 * Express 4 does not forward rejections from async handlers to the error
 * middleware, so a failing await would leave the request hanging until timeout.
 * Wrapping sends them to `next` instead.
 */
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function shouldWrap(fn) {
  // Error middleware takes (err, req, res, next) — leave it alone.
  if (typeof fn !== 'function' || fn.length >= 4) return false;
  // express-validator chains carry a `.run` method and manage their own errors.
  if (typeof fn.run === 'function') return false;
  return fn.constructor.name === 'AsyncFunction';
}

/** Applies `asyncHandler` to every async handler registered on a Router. */
export function wrapRouter(router) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
    const original = router[method].bind(router);
    router[method] = (...args) =>
      original(...args.map((a) => (shouldWrap(a) ? asyncHandler(a) : a)));
  }
  return router;
}
