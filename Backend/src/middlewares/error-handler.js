import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

function sendError(res, req, statusCode, message, errors) {
  const body = {
    success: false,
    message,
    requestId: req.requestId,
  };

  if (errors) {
    body.errors = errors;
  }

  res.status(statusCode).json(body);
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    sendError(
      res,
      req,
      400,
      'Validation failed',
      error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    );
    return;
  }

  if (error.code === 11000) {
    const message = error.keyPattern?.mobile
      ? 'An account with this mobile number already exists'
      : 'An account with this email already exists';
    sendError(
      res,
      req,
      409,
      message,
    );
    return;
  }

  if (error.type === 'entity.parse.failed') {
    sendError(res, req, 400, 'Request body must contain valid JSON');
    return;
  }

  const statusCode = error.statusCode ?? 500;

  if (error.retryAfterSeconds) {
    res.setHeader('Retry-After', String(error.retryAfterSeconds));
  }

  if (statusCode >= 500) {
    logger.error('http.request.failed', {
      requestId: req.requestId,
      statusCode,
      errorType: error.name ?? 'Error',
    });
  }

  sendError(
    res,
    req,
    statusCode,
    error.isOperational ? error.message : 'Internal server error',
  );
}
