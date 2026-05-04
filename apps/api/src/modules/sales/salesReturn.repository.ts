import { Prisma } from '@prisma/client';
import type { Database } from '../../infrastructure/database';

export type SaleReturnTx = Prisma.TransactionClient;

export interface VariantRow {
  id: string;
  barcode: string;
  priceCents: number;
}

export interface StockRow {
  quantity: number;
}

export interface CreateMovementInput {
  storeId: string;
  variantId: string;
  userId: string;
  type: 'sale_return';
  payload: Record<string, unknown>;
}

export interface SaleReturnRepository {
  findVariantByBarcode(barcode: string, tx: SaleReturnTx): Promise<VariantRow | null>;
  findStockBySite(variantId: string, storeId: string, tx: SaleReturnTx): Promise<StockRow | null>;
  incrementStock(
    storeId: string,
    variantId: string,
    qty: number,
    tx: SaleReturnTx,
  ): Promise<number>;
  createMovement(input: CreateMovementInput, tx: SaleReturnTx): Promise<{ id: string }>;
  runTransaction<T>(fn: (tx: SaleReturnTx) => Promise<T>): Promise<T>;
}

export function buildSaleReturnRepository(db: Database): SaleReturnRepository {
  return {
    async findVariantByBarcode(barcode, tx) {
      return tx.variant.findUnique({
        where: { barcode },
        select: { id: true, barcode: true, priceCents: true },
      });
    },

    async findStockBySite(variantId, storeId, tx) {
      return tx.stockBySite.findUnique({
        where: { variantId_storeId: { variantId, storeId } },
        select: { quantity: true },
      });
    },

    async incrementStock(storeId, variantId, qty, tx) {
      const updated = await tx.stockBySite.update({
        where: { variantId_storeId: { variantId, storeId } },
        data: { quantity: { increment: qty } },
        select: { quantity: true },
      });
      return updated.quantity;
    },

    async createMovement(input, tx) {
      const row = await tx.stockMovement.create({
        data: {
          storeId: input.storeId,
          variantId: input.variantId,
          userId: input.userId,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      return { id: row.id };
    },

    async runTransaction(fn) {
      return db.$transaction((tx) => fn(tx as SaleReturnTx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  };
}
