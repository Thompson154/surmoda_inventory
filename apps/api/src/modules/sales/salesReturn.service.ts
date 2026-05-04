import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { assertCanActOnStore, type StoreScopeRepo } from '../../shared/auth/storeScope';
import type { SaleReturnRepository } from './salesReturn.repository';
import type { AuthContext } from './types';

export interface CreateSaleReturnInput {
  storeId: string;
  barcode: string;
  paymentMethod?: 'cash' | 'card' | 'qr';
  reason?: string;
}

export interface SaleReturnResult {
  movementId: string;
  storeId: string;
  variantId: string;
  barcode: string;
  paymentMethod: 'cash' | 'card' | 'qr';
  unitPriceCents: number;
  balanceAfter: number;
  reason?: string;
}

export interface SaleReturnService {
  create(input: CreateSaleReturnInput, auth: AuthContext): Promise<SaleReturnResult>;
}

export interface SaleReturnServiceDeps {
  saleReturn: SaleReturnRepository;
  assignments: StoreScopeRepo;
}

export function buildSaleReturnService({
  saleReturn,
  assignments,
}: SaleReturnServiceDeps): SaleReturnService {
  return {
    async create(input, auth) {
      await assertCanActOnStore(
        assignments,
        input.storeId,
        auth,
        'SALES_RETURN_CREATE_FORBIDDEN_STORE',
        'No tenés acceso a esta sede.',
      );

      const paymentMethod = input.paymentMethod ?? 'cash';

      const result = await saleReturn.runTransaction(async (tx) => {
        const variant = await saleReturn.findVariantByBarcode(input.barcode, tx);
        if (!variant) {
          throw new AppError(
            404,
            ERROR_CODES.SALES_RETURN_CREATE_INVALID_BARCODE,
            'Código de barras no encontrado.',
          );
        }

        const stock = await saleReturn.findStockBySite(variant.id, input.storeId, tx);
        if (!stock) {
          throw new AppError(
            409,
            ERROR_CODES.SALES_RETURN_CREATE_VARIANT_NOT_IN_STORE,
            'Este artículo no tiene inventario en esta sede.',
          );
        }

        const balanceAfter = await saleReturn.incrementStock(input.storeId, variant.id, 1, tx);

        const payload: Record<string, unknown> = {
          quantity: 1,
          balanceAfter,
          paymentMethod,
          unitPriceCents: variant.priceCents,
        };
        if (input.reason !== undefined) payload.reason = input.reason;

        const movement = await saleReturn.createMovement(
          {
            storeId: input.storeId,
            variantId: variant.id,
            userId: auth.userId,
            type: 'sale_return',
            payload,
          },
          tx,
        );

        return {
          movementId: movement.id,
          storeId: input.storeId,
          variantId: variant.id,
          barcode: variant.barcode,
          paymentMethod,
          unitPriceCents: variant.priceCents,
          balanceAfter,
          reason: input.reason,
        };
      });

      return result;
    },
  };
}
