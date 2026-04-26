import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import {
  ConfirmDraftSchema,
  CreateDeliverySchema,
  ListDeliveriesQuerySchema,
  ReceiveDeliverySchema,
  UpdateDraftDeliverySchema,
  WarehouseIntakeSchema,
} from './validators';
import type { AuthContext } from './types';
import type { DeliveryService } from './service';

export interface DeliveryController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  listGrouped(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateDraft(req: Request, res: Response, next: NextFunction): Promise<void>;
  confirmDraft(req: Request, res: Response, next: NextFunction): Promise<void>;
  receive(req: Request, res: Response, next: NextFunction): Promise<void>;
  intakeLookup(req: Request, res: Response, next: NextFunction): Promise<void>;
  intake(req: Request, res: Response, next: NextFunction): Promise<void>;
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
            number: created.number,
            kind: created.kind,
            status: created.status,
            title: created.title,
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

    async updateDraft(req, res, next) {
      try {
        const auth = requireAuth(req);
        const deliveryId = requireParam(req, 'deliveryId');
        const input = UpdateDraftDeliverySchema.parse(req.body);
        const updated = await service.updateDraft(deliveryId, input, auth);
        emitAudit(req, {
          userId: auth.userId,
          action: 'DELIVERY_DRAFT_UPDATED',
          entity: 'Delivery',
          entityId: updated.id,
          payload: {
            number: updated.number,
            itemCount: updated.itemCount,
            totalUnits: updated.totalUnits,
          },
        });
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    },

    async confirmDraft(req, res, next) {
      try {
        const auth = requireAuth(req);
        const deliveryId = requireParam(req, 'deliveryId');
        const input = ConfirmDraftSchema.parse(req.body ?? {});
        const confirmed = await service.confirmDraft(deliveryId, input, auth);
        emitAudit(req, {
          userId: auth.userId,
          action: 'DELIVERY_CONFIRMED',
          entity: 'Delivery',
          entityId: confirmed.id,
          payload: {
            number: confirmed.number,
            title: confirmed.title,
            toStoreId: confirmed.toStoreId,
          },
        });
        res.status(200).json(confirmed);
      } catch (err) {
        next(err);
      }
    },

    async intakeLookup(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const code = String(req.query.code ?? '').trim().toUpperCase();
        if (!code) throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'code es requerido');
        const result = await service.intakeLookup(storeId, code, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async intake(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const input = WarehouseIntakeSchema.parse(req.body);
        const created = await service.intake(storeId, input, auth);
        emitAudit(req, {
          userId: auth.userId,
          action: 'DELIVERY_CREATED',
          entity: 'Delivery',
          entityId: created.id,
          payload: {
            number: created.number,
            kind: 'reception',
            mode: 'intake',
            productCode: input.productCode,
            variantCount: input.variants.length,
            totalUnits: created.totalUnits,
          },
        });
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    async receive(req, res, next) {
      try {
        const auth = requireAuth(req);
        const deliveryId = requireParam(req, 'deliveryId');
        const input = ReceiveDeliverySchema.parse(req.body);
        const received = await service.receive(deliveryId, input, auth);
        emitAudit(req, {
          userId: auth.userId,
          action: received.status === 'partial' ? 'DELIVERY_RECEIVED_PARTIAL' : 'DELIVERY_RECEIVED',
          entity: 'Delivery',
          entityId: received.id,
          payload: {
            number: received.number,
            status: received.status,
            adjustmentCount: received.adjustments.length,
            toStoreId: received.toStoreId,
          },
        });
        res.status(200).json(received);
      } catch (err) {
        next(err);
      }
    },
  };
}
