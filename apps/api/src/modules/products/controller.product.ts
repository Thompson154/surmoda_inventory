import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import {
  CreateProductSchema,
  ListProductsQuerySchema,
  UpdateProductSchema,
} from './validators';
import type { ProductService } from './service.product';

export interface ProductController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  deactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
  reactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  }
  return req.auth;
}

function requireId(req: Request): string {
  const id = req.params.id;
  if (!id) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'id requerido');
  }
  return id;
}

export function buildProductController(service: ProductService): ProductController {
  return {
    async create(req, res, next) {
      try {
        const auth = requireAuth(req);
        const input = CreateProductSchema.parse(req.body);
        const product = await service.create(input);
        emitAudit(req, {
          userId: auth.userId,
          action: 'PRODUCT_CREATED',
          entity: 'Product',
          entityId: product.id,
          payload: { code: product.code, name: product.name },
        });
        res.status(201).json(product);
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        requireAuth(req);
        const query = ListProductsQuerySchema.parse(req.query);
        const result = await service.list(query);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const auth = requireAuth(req);
        const id = requireId(req);
        const includeInactive = req.query.includeInactive === 'true' && auth.isAdmin;
        const product = await service.getById(id, includeInactive);
        res.status(200).json(product);
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const auth = requireAuth(req);
        const id = requireId(req);
        const input = UpdateProductSchema.parse(req.body);
        const product = await service.update(id, input);
        emitAudit(req, {
          userId: auth.userId,
          action: 'PRODUCT_UPDATED',
          entity: 'Product',
          entityId: product.id,
          payload: { changes: input },
        });
        res.status(200).json(product);
      } catch (err) {
        next(err);
      }
    },

    async deactivate(req, res, next) {
      try {
        const auth = requireAuth(req);
        const id = requireId(req);
        const product = await service.deactivate(id);
        emitAudit(req, {
          userId: auth.userId,
          action: 'PRODUCT_DEACTIVATED',
          entity: 'Product',
          entityId: product.id,
          payload: {},
        });
        res.status(200).json(product);
      } catch (err) {
        next(err);
      }
    },

    async reactivate(req, res, next) {
      try {
        const auth = requireAuth(req);
        const id = requireId(req);
        const product = await service.reactivate(id);
        emitAudit(req, {
          userId: auth.userId,
          action: 'PRODUCT_REACTIVATED',
          entity: 'Product',
          entityId: product.id,
          payload: {},
        });
        res.status(200).json(product);
      } catch (err) {
        next(err);
      }
    },
  };
}
