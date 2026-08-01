import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type {
  ReturnRequestRepository,
  ReturnRequestRow,
  PaginatedReturnRequests,
  ReturnPaymentMethod,
  ClosureWithSalesDTO,
} from './repository';

// WHY: 7 days in milliseconds — policy window for return submissions.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateReturnRequestArgs {
  requesterId: string;
  storeId: string;
  returnedVariantBarcode: string;
  returnedQuantity: number;
  saleDate: Date;
  exchangeVariantBarcode?: string | null;
  reason: string;
  // WHY: Wave 5 — when present, validate against original Sale and capture for approve.
  originalSaleId?: string | null;
  originalSaleItemId?: string | null;
  originalClosureDate?: Date | null;
  originalPaymentMethod?: ReturnPaymentMethod | null;
  originalSubtotalCents?: number | null;
  newPaymentMethod?: ReturnPaymentMethod | null;
  newSubtotalCents?: number | null;
}

export interface ListMineArgs {
  requesterId: string;
  status?: 'pending' | 'approved' | 'rejected';
  page: number;
  pageSize: number;
}

export interface ListAllArgs {
  storeId?: string;
  requesterId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  page: number;
  pageSize: number;
}

export interface GetByIdArgs {
  id: string;
  callerId: string;
  isAdmin: boolean;
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

export interface ListClosuresWithSalesArgs {
  storeIds: string[];
  fromDate?: Date;
  toDate?: Date;
}

export interface ReturnRequestService {
  createReturnRequest(args: CreateReturnRequestArgs): Promise<ReturnRequestRow>;
  listMine(args: ListMineArgs): Promise<PaginatedReturnRequests>;
  listAll(args: ListAllArgs): Promise<PaginatedReturnRequests>;
  getById(args: GetByIdArgs): Promise<ReturnRequestRow>;
  approve(args: ApproveArgs): Promise<ReturnRequestRow>;
  reject(args: RejectArgs): Promise<ReturnRequestRow>;
  listClosuresWithSales(args: ListClosuresWithSalesArgs): Promise<ClosureWithSalesDTO[]>;
}

export interface ReturnRequestServiceDeps {
  repo: ReturnRequestRepository;
}

export function buildReturnRequestService({
  repo,
}: ReturnRequestServiceDeps): ReturnRequestService {
  return {
    async createReturnRequest(args) {
      // Validate reason
      if (!args.reason || args.reason.trim().length < 3) {
        throw new AppError(
          400,
          ERROR_CODES.RETURN_REQUEST_CREATE_REASON_REQUIRED,
          'El motivo es requerido y debe tener al menos 3 caracteres.',
        );
      }

      // Validate saleDate within last 7 days
      const now = new Date();
      const diffMs = now.getTime() - args.saleDate.getTime();
      if (diffMs < 0 || diffMs > SEVEN_DAYS_MS) {
        throw new AppError(
          400,
          ERROR_CODES.RETURN_REQUEST_CREATE_INVALID_SALE_DATE,
          'La fecha de venta no puede ser mayor a 7 días atrás.',
        );
      }

      // Resolve returned variant
      const returnedVariant = await repo.findVariantByBarcode(args.returnedVariantBarcode);
      if (!returnedVariant) {
        throw new AppError(
          404,
          ERROR_CODES.RETURN_REQUEST_CREATE_INVALID_VARIANT,
          `Variante con código ${args.returnedVariantBarcode} no encontrada.`,
        );
      }

      // Resolve exchange variant if provided
      let exchangeVariantId: string | null = null;
      if (args.exchangeVariantBarcode) {
        const exchangeVariant = await repo.findVariantByBarcode(args.exchangeVariantBarcode);
        if (!exchangeVariant) {
          throw new AppError(
            404,
            ERROR_CODES.RETURN_REQUEST_CREATE_INVALID_VARIANT,
            `Variante de cambio con código ${args.exchangeVariantBarcode} no encontrada.`,
          );
        }
        exchangeVariantId = exchangeVariant.id;
      }

      // WHY: Wave 5 — when originalSale block is present, verify Sale + SaleItem
      //     belong to the storeId AND the returned-variant matches the saleItem's variant.
      if (args.originalSaleId && args.originalSaleItemId) {
        const lookup = await repo.findOriginalSaleItem(
          args.originalSaleId,
          args.originalSaleItemId,
          args.storeId,
        );
        if (!lookup) {
          throw new AppError(
            404,
            ERROR_CODES.RETURN_REQUEST_CREATE_ORIGINAL_SALE_NOT_FOUND,
            'Venta original no encontrada o no pertenece a esta sede.',
          );
        }
        if (lookup.variantBarcode !== args.returnedVariantBarcode) {
          throw new AppError(
            404,
            ERROR_CODES.RETURN_REQUEST_CREATE_ORIGINAL_SALE_NOT_FOUND,
            'La variante devuelta no corresponde al ítem de la venta original.',
          );
        }
      }

      return repo.createReturnRequest({
        requesterId: args.requesterId,
        storeId: args.storeId,
        returnedVariantId: returnedVariant.id,
        returnedQuantity: args.returnedQuantity,
        saleDate: args.saleDate,
        exchangeVariantId,
        reason: args.reason.trim(),
        status: 'pending',
        originalSaleId: args.originalSaleId ?? null,
        originalSaleItemId: args.originalSaleItemId ?? null,
        originalClosureDate: args.originalClosureDate ?? null,
        originalPaymentMethod: args.originalPaymentMethod ?? null,
        originalSubtotalCents: args.originalSubtotalCents ?? null,
        newPaymentMethod: args.newPaymentMethod ?? null,
        newSubtotalCents: args.newSubtotalCents ?? null,
      });
    },

    async listMine(args) {
      return repo.findReturnRequestsByRequester({
        requesterId: args.requesterId,
        status: args.status,
        page: args.page,
        pageSize: args.pageSize,
      });
    },

    async listAll(args) {
      return repo.findAllReturnRequests({
        storeId: args.storeId,
        requesterId: args.requesterId,
        status: args.status,
        page: args.page,
        pageSize: args.pageSize,
      });
    },

    async getById(args) {
      const rr = await repo.findReturnRequestById(args.id);
      if (!rr) {
        throw new AppError(
          404,
          ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
          'Solicitud no encontrada.',
        );
      }
      if (!args.isAdmin && rr.requesterId !== args.callerId) {
        throw new AppError(
          403,
          ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
          'No tenés acceso a esta solicitud.',
        );
      }
      return rr;
    },

    async approve(args) {
      const rr = await repo.findReturnRequestById(args.id);
      if (!rr) {
        throw new AppError(
          404,
          ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
          'Solicitud no encontrada.',
        );
      }
      if (rr.status !== 'pending') {
        throw new AppError(
          409,
          ERROR_CODES.RETURN_REQUEST_REVIEW_ALREADY_REVIEWED,
          'Esta solicitud ya fue revisada.',
        );
      }

      // Validate exchange stock before entering transaction
      if (rr.exchangeVariantId) {
        const stock = await repo.findStockBySite(rr.exchangeVariantId, rr.storeId);
        const available = stock?.quantity ?? 0;
        if (available < rr.returnedQuantity) {
          throw new AppError(
            409,
            ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
            `Stock insuficiente para el cambio: disponible ${available}, requerido ${rr.returnedQuantity}.`,
          );
        }
      }

      return repo.approveReturnRequest({
        id: args.id,
        reviewerId: args.reviewerId,
        storeId: rr.storeId,
        returnedVariantId: rr.returnedVariantId,
        returnedQuantity: rr.returnedQuantity,
        exchangeVariantId: rr.exchangeVariantId,
        hasExchange: !!rr.exchangeVariantId,
        // WHY: Wave 5 — pass replacement data if captured at create time.
        originalSaleItemId: rr.originalSaleItemId,
        newPaymentMethod: rr.newPaymentMethod,
        newSubtotalCents: rr.newSubtotalCents,
        originalPaymentMethod: rr.originalPaymentMethod,
      });
    },

    async reject(args) {
      const rr = await repo.findReturnRequestById(args.id);
      if (!rr) {
        throw new AppError(
          404,
          ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN,
          'Solicitud no encontrada.',
        );
      }
      if (rr.status !== 'pending') {
        throw new AppError(
          409,
          ERROR_CODES.RETURN_REQUEST_REVIEW_ALREADY_REVIEWED,
          'Esta solicitud ya fue revisada.',
        );
      }
      if (!args.rejectionReason || args.rejectionReason.trim().length < 3) {
        throw new AppError(
          400,
          ERROR_CODES.RETURN_REQUEST_REVIEW_REASON_REQUIRED,
          'El motivo de rechazo es requerido y debe tener al menos 3 caracteres.',
        );
      }

      return repo.rejectReturnRequest({
        id: args.id,
        reviewerId: args.reviewerId,
        rejectionReason: args.rejectionReason.trim(),
      });
    },

    async listClosuresWithSales(args) {
      return repo.listClosuresWithSales({
        storeIds: args.storeIds,
        fromDate: args.fromDate,
        toDate: args.toDate,
      });
    },
  };
}
