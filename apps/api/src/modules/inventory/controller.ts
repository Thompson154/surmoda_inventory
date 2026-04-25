import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import {
  AdjustQuantitySchema,
  ListInventoryQuerySchema,
  ListMovementsQuerySchema,
  TogglePermissionSchema,
} from './validators';
import type { AuthContext } from './types';
import type { InventoryService } from './service';

export interface InventoryController {
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  listGrouped(req: Request, res: Response, next: NextFunction): Promise<void>;
  listVariantsForProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
  adjust(req: Request, res: Response, next: NextFunction): Promise<void>;
  getByBarcode(req: Request, res: Response, next: NextFunction): Promise<void>;
  listMovements(req: Request, res: Response, next: NextFunction): Promise<void>;
  getEditPermission(req: Request, res: Response, next: NextFunction): Promise<void>;
  togglePermission(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  }
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${name} requerido`);
  }
  return value;
}

export function buildInventoryController(service: InventoryService): InventoryController {
  return {
    async list(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const query = ListInventoryQuerySchema.parse(req.query);
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
        const query = ListInventoryQuerySchema.parse(req.query);
        const result = await service.listGrouped(storeId, query, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async listVariantsForProduct(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const productId = requireParam(req, 'productId');
        const result = await service.listVariantsForProduct(storeId, productId, auth);
        res.status(200).json({ items: result });
      } catch (err) {
        next(err);
      }
    },

    async adjust(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const variantId = requireParam(req, 'variantId');
        const input = AdjustQuantitySchema.parse(req.body);
        const row = await service.adjust(storeId, variantId, input, auth);
        emitAudit(req, {
          userId: auth.userId,
          action: 'INVENTORY_QUANTITY_ADJUSTED',
          entity: 'Stock',
          entityId: `${storeId}:${variantId}`,
          payload: {
            storeId,
            variantId,
            previous: row.previous,
            next: row.quantity,
            delta: row.delta,
            reason: input.reason ?? null,
          },
        });
        res.status(200).json(row);
      } catch (err) {
        next(err);
      }
    },

    async getByBarcode(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const barcode = requireParam(req, 'barcode');
        const row = await service.getByBarcode(storeId, barcode, auth);
        res.status(200).json(row);
      } catch (err) {
        next(err);
      }
    },

    async listMovements(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const query = ListMovementsQuerySchema.parse(req.query);
        const result = await service.listMovements(storeId, query, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async getEditPermission(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const result = await service.getEditPermission(storeId, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async togglePermission(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const input = TogglePermissionSchema.parse(req.body);
        const result = await service.togglePermission(storeId, input, auth);
        emitAudit(req, {
          userId: auth.userId,
          action: 'STORE_EDIT_PERMISSION_TOGGLED',
          entity: 'StoreEditPermission',
          entityId: storeId,
          payload: { storeId, isEnabled: input.isEnabled },
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
