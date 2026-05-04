import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { assertCanActOnStore } from '../../shared/auth/storeScope';
import type { StoreScopeRepo } from '../../shared/auth/storeScope';
import type { AuditService } from '../auditing/service';
import type { ReturnRequestService } from './service';
import {
  CreateReturnRequestBodySchema,
  ListMineQuerySchema,
  ListAllQuerySchema,
  RejectBodySchema,
  ClosuresWithSalesQuerySchema,
} from './validators';

// WHY: admin uses admin:everything wildcard — can() returns false for granular actions.
function isAdmin(auth: { isAdmin: boolean }): boolean {
  return auth.isAdmin;
}

export interface ReturnRequestController {
  submit(req: Request, res: Response, next: NextFunction): Promise<void>;
  listMine(req: Request, res: Response, next: NextFunction): Promise<void>;
  listAll(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  approve(req: Request, res: Response, next: NextFunction): Promise<void>;
  reject(req: Request, res: Response, next: NextFunction): Promise<void>;
  closuresWithSales(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export interface ReturnRequestControllerDeps {
  service: ReturnRequestService;
  audit: AuditService;
  scope: StoreScopeRepo;
}

export function buildReturnRequestController({
  service,
  audit,
  scope,
}: ReturnRequestControllerDeps): ReturnRequestController {
  return {
    async submit(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }

        const body = CreateReturnRequestBodySchema.parse(req.body);

        // RBAC: must be vendedora/encargada of the store
        await assertCanActOnStore(
          scope,
          body.storeId,
          req.auth,
          'RETURN_REQUEST_CREATE_FORBIDDEN_STORE',
          'No tenés permisos para crear solicitudes en esta sede.',
        );

        const rr = await service.createReturnRequest({
          requesterId: req.auth.userId,
          storeId: body.storeId,
          returnedVariantBarcode: body.returnedVariantBarcode,
          returnedQuantity: body.returnedQuantity,
          saleDate: new Date(body.saleDate),
          exchangeVariantBarcode: body.exchangeVariantBarcode,
          reason: body.reason,
          // WHY: Wave 5 — pass through the optional original-sale block.
          originalSaleId: body.originalSaleId ?? null,
          originalSaleItemId: body.originalSaleItemId ?? null,
          originalClosureDate: body.originalClosureDate ? new Date(body.originalClosureDate) : null,
          originalPaymentMethod: body.originalPaymentMethod ?? null,
          originalSubtotalCents: body.originalSubtotalCents ?? null,
          newPaymentMethod: body.newPaymentMethod ?? null,
          newSubtotalCents: body.newSubtotalCents ?? null,
        });

        setImmediate(() => {
          audit.write({
            userId: req.auth?.userId,
            action: 'RETURN_REQUEST_CREATE',
            entity: 'ReturnRequest',
            entityId: rr.id,
            payload: { storeId: body.storeId, returnedVariantBarcode: body.returnedVariantBarcode },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        });

        res.status(201).json(rr);
      } catch (err) {
        next(err);
      }
    },

    async listMine(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }
        // WHY: admin should use GET / instead — returning 400 keeps endpoint semantics clear.
        if (isAdmin(req.auth)) {
          throw new AppError(
            400,
            ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
            'Los admins deben usar GET /return-requests en lugar de /mine.',
          );
        }

        const query = ListMineQuerySchema.parse(req.query);

        const result = await service.listMine({
          requesterId: req.auth.userId,
          status: query.status,
          page: query.page,
          pageSize: query.pageSize,
        });

        res.json(result);
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
            ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
            'Solo admin puede ver todas las solicitudes.',
          );
        }

        const query = ListAllQuerySchema.parse(req.query);

        const result = await service.listAll({
          storeId: query.storeId,
          requesterId: query.requesterId,
          status: query.status,
          page: query.page,
          pageSize: query.pageSize,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }

        const rr = await service.getById({
          id: req.params['id'] as string,
          callerId: req.auth.userId,
          isAdmin: isAdmin(req.auth),
        });

        res.json(rr);
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
            ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
            'Solo admin puede aprobar solicitudes.',
          );
        }

        const rr = await service.approve({
          id: req.params['id'] as string,
          reviewerId: req.auth.userId,
        });

        setImmediate(() => {
          audit.write({
            userId: req.auth?.userId,
            action: 'RETURN_REQUEST_APPROVE',
            entity: 'ReturnRequest',
            entityId: rr.id,
            payload: { storeId: rr.storeId },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        });

        res.json(rr);
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
            ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
            'Solo admin puede rechazar solicitudes.',
          );
        }

        const body = RejectBodySchema.parse(req.body);

        const rr = await service.reject({
          id: req.params['id'] as string,
          reviewerId: req.auth.userId,
          rejectionReason: body.rejectionReason,
        });

        setImmediate(() => {
          audit.write({
            userId: req.auth?.userId,
            action: 'RETURN_REQUEST_REJECT',
            entity: 'ReturnRequest',
            entityId: rr.id,
            payload: { storeId: rr.storeId, rejectionReason: body.rejectionReason },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        });

        res.json(rr);
      } catch (err) {
        next(err);
      }
    },

    async closuresWithSales(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado.');
        }

        const query = ClosuresWithSalesQuerySchema.parse(req.query);

        // RBAC: vendedora/encargada must be assigned to the storeId; admin always allowed.
        await assertCanActOnStore(
          scope,
          query.storeId,
          req.auth,
          'RETURN_REQUEST_CREATE_FORBIDDEN_STORE',
          'No tenés acceso a esta sede.',
        );

        const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
        const toDate = query.toDate ? new Date(query.toDate) : undefined;

        const closures = await service.listClosuresWithSales({
          storeIds: [query.storeId],
          fromDate,
          toDate,
        });

        res.json(closures);
      } catch (err) {
        next(err);
      }
    },
  };
}
