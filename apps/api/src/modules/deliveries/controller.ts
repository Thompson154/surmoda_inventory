import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import { CreateDeliverySchema, ListDeliveriesQuerySchema } from './validators';
import type { AuthContext } from './types';
import type { DeliveryService } from './service';

export interface DeliveryController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  listGrouped(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  }
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${name} requerido`);
  return value;
}

export function buildDeliveryController(service: DeliveryService): DeliveryController {
  return {
    async create(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const input = CreateDeliverySchema.parse(req.body);
        const created = await service.create(storeId, input, auth);
        emitAudit(req, {
          userId: auth.userId,
          action: 'DELIVERY_CREATED',
          entity: 'Delivery',
          entityId: created.id,
          payload: {
            kind: created.kind,
            fromStoreId: created.fromStoreId,
            toStoreId: created.toStoreId,
            itemCount: created.itemCount,
            totalUnits: created.totalUnits,
          },
        });
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const query = ListDeliveriesQuerySchema.parse(req.query);
        const result = await service.list(storeId, query, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async listGrouped(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const query = ListDeliveriesQuerySchema.parse(req.query);
        const result = await service.listGrouped(storeId, query, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const auth = requireAuth(req);
        const deliveryId = requireParam(req, 'deliveryId');
        const result = await service.getById(deliveryId, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
