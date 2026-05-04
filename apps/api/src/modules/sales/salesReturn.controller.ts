import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import { CreateSaleReturnSchema } from './salesReturn.validators';
import type { SaleReturnService } from './salesReturn.service';
import type { AuthContext } from './types';

export interface SaleReturnController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

export function buildSaleReturnController(service: SaleReturnService): SaleReturnController {
  return {
    async create(req, res, next) {
      try {
        const auth = requireAuth(req);
        const input = CreateSaleReturnSchema.parse(req.body);
        const result = await service.create(input, auth);

        // WHY: fire-and-forget audit keeps latency under 50ms per constitution PARTE VI.
        emitAudit(req, {
          userId: auth.userId,
          action: 'SALE_RETURN_CREATE',
          entity: 'StockMovement',
          entityId: result.movementId,
          payload: {
            storeId: result.storeId,
            barcode: result.barcode,
            paymentMethod: result.paymentMethod,
            unitPriceCents: result.unitPriceCents,
          },
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
