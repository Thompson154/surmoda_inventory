import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { AuthContext, AlertsService } from './service';

export interface AlertsController {
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

export function buildAlertsController(service: AlertsService): AlertsController {
  return {
    async list(req, res, next) {
      try {
        const auth = requireAuth(req);
        // Optional: filter to a specific branch. When absent, all stores are returned.
        const storeId = typeof req.query['storeId'] === 'string' ? req.query['storeId'] : undefined;
        const result = await service.list(auth, storeId);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
