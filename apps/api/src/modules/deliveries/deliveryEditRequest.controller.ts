import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { assertCanActOnStore } from '../../shared/auth/storeScope';
import type { StoreScopeRepo } from '../../shared/auth/storeScope';
import type { AuditService } from '../auditing/service';
import type { DeliveryEditRequestService } from './deliveryEditRequest.service';
import {
  CreateDeliveryEditRequestBodySchema,
  RejectDeliveryEditRequestBodySchema,
  ListDeliveryEditRequestsQuerySchema,
} from './deliveryEditRequest.validators';

// WHY: admin uses admin:everything wildcard — controllers check this directly.
function isAdmin(auth: { isAdmin: boolean }): boolean {
  return auth.isAdmin;
}

export interface DeliveryEditRequestController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  listByDelivery(req: Request, res: Response, next: NextFunction): Promise<void>;
  listAll(req: Request, res: Response, next: NextFunction): Promise<void>;
  approve(req: Request, res: Response, next: NextFunction): Promise<void>;
  reject(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export interface DeliveryEditRequestControllerDeps {
  service: DeliveryEditRequestService;
  audit: AuditService;
  scope: StoreScopeRepo;
}

export function buildDeliveryEditRequestController({
  service,
  audit,
  scope,
}: DeliveryEditRequestControllerDeps): DeliveryEditRequestController {
  return {
    async create(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }
        const deliveryId = req.params['deliveryId'] as string;
        if (!deliveryId) {
          throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'deliveryId requerido.');
        }
        const body = CreateDeliveryEditRequestBodySchema.parse(req.body);

        const header = await service.resolveDeliveryHeader(deliveryId);
        await assertCanActOnStore(
          scope,
          header.toStoreId,
          req.auth,
          'DELIVERY_EDIT_REQUEST_CREATE_FORBIDDEN_STORE',
          'No tenés acceso a esta sede.',
        );

        const created = await service.create({
          deliveryId,
          requesterId: req.auth.userId,
          reason: body.reason,
        });

        setImmediate(() => {
          audit.write({
            userId: req.auth?.userId,
            action: 'DELIVERY_EDIT_REQUEST_CREATE',
            entity: 'DeliveryEditRequest',
            entityId: created.id,
            payload: { deliveryId, storeId: header.toStoreId },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        });

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    async listByDelivery(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }
        const deliveryId = req.params['deliveryId'] as string;
        const header = await service.resolveDeliveryHeader(deliveryId);
        // WHY: requester can see their own; admin sees all; vendedora-of-store can see all of her store.
        await assertCanActOnStore(
          scope,
          header.toStoreId,
          req.auth,
          'DELIVERY_EDIT_REQUEST_REVIEW_FORBIDDEN',
          'No tenés acceso a esta sede.',
        );

        const rows = await service.listByDelivery({
          deliveryId,
          callerId: req.auth.userId,
          isAdmin: isAdmin(req.auth),
        });
        res.json(rows);
      } catch (err) {
        next(err);
      }
    },

    async listAll(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }
        if (!isAdmin(req.auth)) {
          throw new AppError(
            403,
            ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_FORBIDDEN,
            'Solo admin puede ver la cola global.',
          );
        }
        const query = ListDeliveryEditRequestsQuerySchema.parse(req.query);
        const result = await service.listAll({
          status: query.status,
          storeId: query.storeId,
          page: query.page,
          pageSize: query.pageSize,
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },

    async approve(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }
        if (!isAdmin(req.auth)) {
          throw new AppError(
            403,
            ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_FORBIDDEN,
            'Solo admin puede aprobar solicitudes.',
          );
        }
        const id = req.params['id'] as string;
        const updated = await service.approve({ id, reviewerId: req.auth.userId });

        setImmediate(() => {
          audit.write({
            userId: req.auth?.userId,
            action: 'DELIVERY_EDIT_REQUEST_APPROVE',
            entity: 'DeliveryEditRequest',
            entityId: updated.id,
            payload: { deliveryId: updated.deliveryId },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        });

        res.json(updated);
      } catch (err) {
        next(err);
      }
    },

    async reject(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }
        if (!isAdmin(req.auth)) {
          throw new AppError(
            403,
            ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_FORBIDDEN,
            'Solo admin puede rechazar solicitudes.',
          );
        }
        const id = req.params['id'] as string;
        const body = RejectDeliveryEditRequestBodySchema.parse(req.body);

        const updated = await service.reject({
          id,
          reviewerId: req.auth.userId,
          rejectionReason: body.rejectionReason,
        });

        setImmediate(() => {
          audit.write({
            userId: req.auth?.userId,
            action: 'DELIVERY_EDIT_REQUEST_REJECT',
            entity: 'DeliveryEditRequest',
            entityId: updated.id,
            payload: { deliveryId: updated.deliveryId, rejectionReason: body.rejectionReason },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        });

        res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  };
}
