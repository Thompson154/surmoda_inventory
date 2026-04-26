import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { ReportSummaryQuerySchema } from './validators';
import type { AuthContext } from './types';
import type { ReportService } from './service';

export interface ReportController {
  summary(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

export function buildReportController(service: ReportService): ReportController {
  return {
    async summary(req, res, next) {
      try {
        const auth = requireAuth(req);
        const query = ReportSummaryQuerySchema.parse(req.query);
        const result = await service.getSummary(query.from, query.to, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
