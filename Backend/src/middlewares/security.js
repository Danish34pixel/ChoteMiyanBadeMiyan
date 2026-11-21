import cors from 'cors';
import helmet from 'helmet';
import { getAllowedOrigins } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const allowedOrigins = new Set(getAllowedOrigins());

export const securityHeaders = helmet();

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new AppError('Origin is not allowed', 403));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
});
