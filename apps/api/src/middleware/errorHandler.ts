import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../shared/errors/AppError';
import { ERROR_CODES } from '../shared/constants/errorCodes';
import { logger } from '../infrastructure/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Request validation failed',
      details: err.issues.map((i) => ({ path: i.path, message: i.message, code: i.code })),
    });
    return;
  }

  // WHY: never leak unexpected error messages to the client
  logger.error({ err }, 'Unhandled error in request pipeline');
  res.status(500).json({
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Internal server error',
  });
};

export type { AppError };
