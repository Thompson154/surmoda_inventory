import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type {
  DeliveryEditRequestRepository,
  DeliveryEditRequestRow,
  PaginatedDeliveryEditRequests,
} from './deliveryEditRequest.repository';

export interface CreateEditRequestArgs {
  deliveryId: string;
  requesterId: string;
  reason: string;
}

export interface ListByDeliveryArgs {
  deliveryId: string;
  callerId: string;
  isAdmin: boolean;
}

export interface ListAllArgs {
  status?: 'pending' | 'approved' | 'rejected';
  storeId?: string;
  page: number;
  pageSize: number;
}

export interface ApproveArgs {
  id: string;
  reviewerId: string;
}

export interface RejectArgs {
  id: string;
  reviewerId: string;
  rejectionReason: string;
}

export interface DeliveryEditRequestService {
  // WHY: returns the resolved delivery header so the controller can RBAC-scope on toStoreId.
  resolveDeliveryHeader(deliveryId: string): Promise<{ toStoreId: string; status: string }>;
  create(args: CreateEditRequestArgs): Promise<DeliveryEditRequestRow>;
  listByDelivery(args: ListByDeliveryArgs): Promise<DeliveryEditRequestRow[]>;
  listAll(args: ListAllArgs): Promise<PaginatedDeliveryEditRequests>;
  approve(args: ApproveArgs): Promise<DeliveryEditRequestRow>;
  reject(args: RejectArgs): Promise<DeliveryEditRequestRow>;
}

export interface DeliveryEditRequestServiceDeps {
  repo: DeliveryEditRequestRepository;
}

export function buildDeliveryEditRequestService({
  repo,
}: DeliveryEditRequestServiceDeps): DeliveryEditRequestService {
  return {
    async resolveDeliveryHeader(deliveryId) {
      const header = await repo.findDeliveryHeader(deliveryId);
      if (!header) {
        throw new AppError(404, ERROR_CODES.DELIVERY_NOT_FOUND, 'Entrega no encontrada.');
      }
      return { toStoreId: header.toStoreId, status: header.status };
    },

    async create(args) {
      // WHY: Wave 5 — only sent deliveries can have an edit request raised.
      const header = await repo.findDeliveryHeader(args.deliveryId);
      if (!header) {
        throw new AppError(404, ERROR_CODES.DELIVERY_NOT_FOUND, 'Entrega no encontrada.');
      }
      if (header.status !== 'sent') {
        throw new AppError(
          409,
          ERROR_CODES.DELIVERY_EDIT_REQUEST_CREATE_INVALID_STATUS,
          'Solo se pueden solicitar ediciones sobre entregas en estado "sent".',
        );
      }
      if (!args.reason || args.reason.trim().length < 50) {
        throw new AppError(
          400,
          ERROR_CODES.DELIVERY_EDIT_REQUEST_CREATE_REASON_TOO_SHORT,
          'El motivo debe tener al menos 50 caracteres.',
        );
      }
      return repo.create({
        deliveryId: args.deliveryId,
        requesterId: args.requesterId,
        reason: args.reason.trim(),
      });
    },

    async listByDelivery(args) {
      const rows = await repo.listByDelivery(args.deliveryId);
      // WHY: non-admins only see their own requests for that delivery.
      if (args.isAdmin) return rows;
      return rows.filter((r) => r.requesterId === args.callerId);
    },

    async listAll(args) {
      return repo.listAll({
        status: args.status,
        storeId: args.storeId,
        page: args.page,
        pageSize: args.pageSize,
      });
    },

    async approve(args) {
      const r = await repo.findById(args.id);
      if (!r) {
        throw new AppError(
          404,
          ERROR_CODES.DELIVERY_EDIT_REQUEST_NOT_FOUND,
          'Solicitud de edición no encontrada.',
        );
      }
      if (r.status !== 'pending') {
        throw new AppError(
          409,
          ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_ALREADY_REVIEWED,
          'Esta solicitud ya fue revisada.',
        );
      }
      return repo.approve({ id: args.id, reviewerId: args.reviewerId });
    },

    async reject(args) {
      const r = await repo.findById(args.id);
      if (!r) {
        throw new AppError(
          404,
          ERROR_CODES.DELIVERY_EDIT_REQUEST_NOT_FOUND,
          'Solicitud de edición no encontrada.',
        );
      }
      if (r.status !== 'pending') {
        throw new AppError(
          409,
          ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_ALREADY_REVIEWED,
          'Esta solicitud ya fue revisada.',
        );
      }
      if (!args.rejectionReason || args.rejectionReason.trim().length < 3) {
        throw new AppError(
          400,
          ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_REASON_REQUIRED,
          'El motivo de rechazo es requerido.',
        );
      }
      return repo.reject({
        id: args.id,
        reviewerId: args.reviewerId,
        rejectionReason: args.rejectionReason.trim(),
      });
    },
  };
}
