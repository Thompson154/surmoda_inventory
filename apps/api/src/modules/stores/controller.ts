import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import { CreateStoreSchema, ListStoresQuerySchema, UpdateStoreSchema } from './validators';
import type { StoreService } from './service';
import type { AuthContext } from './types';

export interface StoreController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  deactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
  reactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  }
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

function requireId(req: Request): string {
  const id = req.params.id;
  if (!id) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'id requerido');
  }
  return id;
}

export function buildStoreController(service: StoreService): StoreController {
  return {
    async create(req, res, next) {
      try {
        const input = CreateStoreSchema.parse(req.body);
        const auth = requireAuth(req);
        const store = await service.create(input);
        emitAudit(req, {
          userId: auth.userId,
          action: 'STORE_CREATED',
          entity: 'Store',
          entityId: store.id,
          payload: { code: store.code, kind: store.kind },
        });
        res.status(201).json(store);
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const query = ListStoresQuerySchema.parse(req.query);
        const auth = requireAuth(req);
        const result = await service.list(query, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const id = requireId(req);
        const auth = requireAuth(req);
        const store = await service.getById(id, auth);
        res.status(200).json(store);
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const id = requireId(req);
        const input = UpdateStoreSchema.parse(req.body);
        const auth = requireAuth(req);
        const store = await service.update(id, input);
        emitAudit(req, {
          userId: auth.userId,
          action: 'STORE_UPDATED',
          entity: 'Store',
          entityId: store.id,
          payload: { changes: input },
        });
        res.status(200).json(store);
      } catch (err) {
        next(err);
      }
    },

    async deactivate(req, res, next) {
      try {
        const id = requireId(req);
        const auth = requireAuth(req);
        const store = await service.deactivate(id);
        emitAudit(req, {
          userId: auth.userId,
          action: 'STORE_DEACTIVATED',
          entity: 'Store',
          entityId: store.id,
          payload: {},
        });
        res.status(200).json(store);
      } catch (err) {
        next(err);
      }
    },

    async reactivate(req, res, next) {
      try {
        const id = requireId(req);
        const auth = requireAuth(req);
        const store = await service.reactivate(id);
        emitAudit(req, {
          userId: auth.userId,
          action: 'STORE_REACTIVATED',
          entity: 'Store',
          entityId: store.id,
          payload: {},
        });
        res.status(200).json(store);
      } catch (err) {
        next(err);
      }
    },
  };
}
