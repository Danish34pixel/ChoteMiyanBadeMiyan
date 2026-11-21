import { logger as applicationLogger } from '../utils/logger.js';

export function createRequestLogger(logger = applicationLogger) {
  return function requestLogger(req, res, next) {
    const startedAt = performance.now();

    res.once('finish', () => {
      const route = req.route
        ? `${req.baseUrl}${req.route.path}`
        : 'unmatched';

      logger.info('http.request.completed', {
        requestId: req.requestId,
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
      });
    });

    next();
  };
}

export const requestLogger = createRequestLogger();
