import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { AuthContext } from '../../shared/auth/storeScope';
import type { AuditQueryService } from './queryService';

const ListAuditLogsQuerySchema = z
  .object({
    userId: z.string().min(1).max(64).optional(),
    storeId: z.string().min(1).max(64).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export interface AuditController {
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

export function buildAuditController(service: AuditQueryService): AuditController {
  return {
    async list(req, res, next) {
      try {
        const auth = requireAuth(req);
        const query = ListAuditLogsQuerySchema.parse(req.query);
        const result = await service.list(query, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
