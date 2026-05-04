// Repository for POST /api/v1/reports/sales.
// Cursor-based pagination for the xlsx streaming path; count + preview for the
// JSON preview path.

import type { Database } from '../../infrastructure/database';
import { SIZE_FROM_PRISMA, PM_FROM_PRISMA } from '../../shared/enums/mappings';
import type { StoreInfo, SalesRow, InventoryRow, PaymentSummary } from './salesReport.types';

// ─── Types exposed to service ─────────────────────────────────────────────────

export interface SnapshotInventoryResult {
  rows: InventoryRow[];
  capturedAt: Date;
}

export interface SalesReportRepository {
  findStore(storeId: string): Promise<StoreInfo | null>;

  /** Preview: up to `limit` rows starting at cursor (default limit=50). */
  getSalesInPeriod(
    storeId: string,
    from: Date,
    to: Date,
    limit?: number,
    cursor?: string,
  ): Promise<SalesRow[]>;

  /** Total count of sale_items in the period for the store. */
  getSalesTotalCount(storeId: string, from: Date, to: Date): Promise<number>;

  /** Sum of subtotalCents for all sale_items in the period. */
  getSalesTotalAmount(storeId: string, from: Date, to: Date): Promise<number>;

  /** Payment method breakdown for the period. */
  getPaymentTotals(storeId: string, from: Date, to: Date): Promise<PaymentSummary>;

  /**
   * Cursor-based iterator for xlsx streaming: returns one batch of SalesRows
   * starting after `cursor` (a saleId). Use undefined for the first batch.
   */
  getSalesBatch(
    storeId: string,
    from: Date,
    to: Date,
    pageSize: number,
    cursor?: string,
  ): Promise<{ rows: SalesRow[]; lastCursor: string | undefined }>;

  /** Live stock from stockBySite for the given store. */
  getLiveInventory(storeId: string): Promise<InventoryRow[]>;

  /**
   * Historical inventory from inventory_snapshots.
   * Finds the most recent snapshot batch with capturedAt <= asOf.
   * Returns null if no snapshot exists.
   */
  getSnapshotInventory(storeId: string, asOf: Date): Promise<SnapshotInventoryResult | null>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

function toSalesRow(sale: {
  id: string;
  paymentMethod: import('@prisma/client').PaymentMethod;
  createdAt: Date;
  user: { fullName: string };
  items: Array<{
    priceAtSaleCents: number;
    subtotalCents: number;
    quantity: number;
    variant: {
      size: import('@prisma/client').Size;
      color: string;
      product: { code: string; name: string };
    };
  }>;
}): SalesRow[] {
  // One SalesRow per SaleItem line
  return sale.items.map((item) => {
    const dt = sale.createdAt;
    const saleDate = dt.toISOString().slice(0, 10);
    const saleTime = dt.toISOString().slice(11, 19);
    const size = SIZE_FROM_PRISMA[item.variant.size];
    const variantDescription = `${item.variant.product.name} ${item.variant.color} talla ${size}`;

    return {
      saleDate,
      saleTime,
      ticketNumber: sale.id,
      productCode: item.variant.product.code,
      variantDescription,
      color: item.variant.color,
      size,
      quantity: item.quantity,
      unitPriceCents: item.priceAtSaleCents,
      subtotalCents: item.subtotalCents,
      paymentMethod: PM_FROM_PRISMA[sale.paymentMethod],
      cashier: sale.user.fullName,
    };
  });
}

const SALE_INCLUDE = {
  user: { select: { fullName: true } },
  items: {
    include: {
      variant: {
        select: {
          size: true,
          color: true,
          product: { select: { code: true, name: true } },
        },
      },
    },
  },
} as const;

export function buildSalesReportRepository(db: Database): SalesReportRepository {
  return {
    async findStore(storeId) {
      const row = await db.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, code: true },
      });
      return row ?? null;
    },

    async getSalesInPeriod(storeId, from, to, limit = 50, cursor) {
      const sales = await db.sale.findMany({
        where: { storeId, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        include: SALE_INCLUDE,
      });
      return sales.flatMap((s) => toSalesRow(s));
    },

    async getSalesTotalCount(storeId, from, to) {
      // Count SaleItems (not Sales) because each line is one row in the report
      return db.saleItem.count({
        where: { sale: { storeId, createdAt: { gte: from, lte: to } } },
      });
    },

    async getSalesTotalAmount(storeId, from, to) {
      const result = await db.saleItem.aggregate({
        where: { sale: { storeId, createdAt: { gte: from, lte: to } } },
        _sum: { subtotalCents: true },
      });
      return result._sum.subtotalCents ?? 0;
    },

    async getPaymentTotals(storeId, from, to) {
      const sales = await db.sale.findMany({
        where: { storeId, createdAt: { gte: from, lte: to } },
        select: { paymentMethod: true, totalCents: true },
      });

      let cash = 0;
      let card = 0;
      let qr = 0;
      for (const s of sales) {
        const pm = PM_FROM_PRISMA[s.paymentMethod];
        if (pm === 'cash') cash += s.totalCents;
        else if (pm === 'card') card += s.totalCents;
        else if (pm === 'qr') qr += s.totalCents;
      }

      return { cash, card, qr, total: cash + card + qr };
    },

    async getSalesBatch(storeId, from, to, pageSize, cursor) {
      const sales = await db.sale.findMany({
        where: { storeId, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'asc' },
        take: pageSize,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        include: SALE_INCLUDE,
      });

      const rows = sales.flatMap((s) => toSalesRow(s));
      const lastCursor = sales[sales.length - 1]?.id;
      return { rows, lastCursor };
    },

    async getLiveInventory(storeId) {
      const rows = await db.stockBySite.findMany({
        where: { storeId },
        include: {
          variant: {
            select: {
              size: true,
              color: true,
              priceCents: true,
              product: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: { variant: { product: { code: 'asc' } } },
      });

      return rows.map((r) => {
        const size = SIZE_FROM_PRISMA[r.variant.size];
        return {
          productCode: r.variant.product.code,
          variantDescription: `${r.variant.product.name} ${r.variant.color} talla ${size}`,
          color: r.variant.color,
          size,
          quantity: r.quantity,
          unitPriceCents: r.variant.priceCents,
        };
      });
    },

    async getSnapshotInventory(storeId, asOf) {
      // Step 1: find the most recent batch capturedAt <= asOf
      const latest = await db.inventorySnapshot.findFirst({
        where: { storeId, capturedAt: { lte: asOf } },
        orderBy: { capturedAt: 'desc' },
        select: { capturedAt: true },
      });
      if (!latest) return null;

      // Step 2: pull all rows from that batch, joined to variant/product
      const snapshotRows = await db.inventorySnapshot.findMany({
        where: { storeId, capturedAt: latest.capturedAt },
        include: {
          variant: {
            select: {
              size: true,
              color: true,
              priceCents: true,
              product: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: { variant: { product: { code: 'asc' } } },
      });

      const rows: InventoryRow[] = snapshotRows.map((r) => {
        const size = SIZE_FROM_PRISMA[r.variant.size];
        return {
          productCode: r.variant.product.code,
          variantDescription: `${r.variant.product.name} ${r.variant.color} talla ${size}`,
          color: r.variant.color,
          size,
          quantity: r.quantity,
          unitPriceCents: r.variant.priceCents,
        };
      });

      return { rows, capturedAt: latest.capturedAt };
    },
  };
}
