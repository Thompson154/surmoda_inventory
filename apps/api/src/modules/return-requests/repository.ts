import { Prisma } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import { PM_TO_PRISMA, PM_FROM_PRISMA } from '../../shared/enums/mappings';
import { isoDateBolivia } from '../../shared/datetime/bolivia';

export interface VariantRow {
  id: string;
}

export interface StockBySiteRow {
  quantity: number;
}

export type ReturnPaymentMethod = 'cash' | 'card' | 'qr';

export interface ReturnRequestRow {
  id: string;
  requesterId: string;
  storeId: string;
  status: 'pending' | 'approved' | 'rejected';
  returnedVariantId: string;
  returnedQuantity: number;
  saleDate: Date;
  exchangeVariantId: string | null;
  reason: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  appliedReturnMovementId: string | null;
  appliedSaleMovementId: string | null;
  // WHY: Wave 5 — captured original-sale + new-sale snapshot for replacement on approve.
  originalSaleId: string | null;
  originalSaleItemId: string | null;
  originalClosureDate: Date | null;
  originalPaymentMethod: ReturnPaymentMethod | null;
  originalSubtotalCents: number | null;
  newPaymentMethod: ReturnPaymentMethod | null;
  newSubtotalCents: number | null;
  createdAt: Date;
}

export interface CreateReturnRequestInput {
  requesterId: string;
  storeId: string;
  returnedVariantId: string;
  returnedQuantity: number;
  saleDate: Date;
  exchangeVariantId?: string | null;
  reason: string;
  status: 'pending';
  // WHY: Wave 5 — optional original-sale block written verbatim when present.
  originalSaleId?: string | null;
  originalSaleItemId?: string | null;
  originalClosureDate?: Date | null;
  originalPaymentMethod?: ReturnPaymentMethod | null;
  originalSubtotalCents?: number | null;
  newPaymentMethod?: ReturnPaymentMethod | null;
  newSubtotalCents?: number | null;
}

export interface ApproveReturnRequestInput {
  id: string;
  reviewerId: string;
  storeId: string;
  returnedVariantId: string;
  returnedQuantity: number;
  exchangeVariantId: string | null;
  hasExchange: boolean;
  // WHY: Wave 5 — when set, admin's approve replaces the original SaleItem in place.
  originalSaleItemId?: string | null;
  newPaymentMethod?: ReturnPaymentMethod | null;
  newSubtotalCents?: number | null;
  /** Payment method of the original sale — used for audit trail accuracy. */
  originalPaymentMethod?: ReturnPaymentMethod | null;
}

export interface RejectReturnRequestInput {
  id: string;
  reviewerId: string;
  rejectionReason: string;
}

export interface ListReturnRequestsFilter {
  requesterId?: string;
  storeId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  page: number;
  pageSize: number;
}

export interface PaginatedReturnRequests {
  rows: ReturnRequestRow[];
  total: number;
}

export interface OriginalSaleItemLookup {
  saleId: string;
  saleItemId: string;
  storeId: string;
  variantId: string;
  variantBarcode: string;
}

export interface ClosureSaleItemDTO {
  id: string;
  variantBarcode: string;
  productName: string;
  quantity: number;
  paymentMethod: ReturnPaymentMethod;
  subtotalCents: number;
  totalCents: number;
}

export interface ClosureSaleDTO {
  saleId: string;
  saleItems: ClosureSaleItemDTO[];
}

export interface ClosureWithSalesDTO {
  closureDate: string;
  closureId: string | null;
  sales: ClosureSaleDTO[];
}

export interface ReturnRequestRepository {
  findVariantByBarcode(barcode: string): Promise<VariantRow | null>;
  findStockBySite(variantId: string, storeId: string): Promise<StockBySiteRow | null>;
  // WHY: Wave 5 — verify the original sale + saleItem belong to the chosen store.
  findOriginalSaleItem(
    saleId: string,
    saleItemId: string,
    storeId: string,
  ): Promise<OriginalSaleItemLookup | null>;
  createReturnRequest(input: CreateReturnRequestInput): Promise<ReturnRequestRow>;
  findReturnRequestsByRequester(filter: ListReturnRequestsFilter): Promise<PaginatedReturnRequests>;
  findAllReturnRequests(filter: ListReturnRequestsFilter): Promise<PaginatedReturnRequests>;
  findReturnRequestById(id: string): Promise<ReturnRequestRow | null>;
  approveReturnRequest(input: ApproveReturnRequestInput): Promise<ReturnRequestRow>;
  rejectReturnRequest(input: RejectReturnRequestInput): Promise<ReturnRequestRow>;
  // WHY: Wave 5 — picker UI lists last-7-days closures + their sales for store(s).
  listClosuresWithSales(input: {
    storeIds: string[];
    fromDate?: Date;
    toDate?: Date;
  }): Promise<ClosureWithSalesDTO[]>;
}

const INCLUDE_FULL = {
  requester: { select: { id: true, fullName: true, email: true } },
  reviewer: { select: { id: true, fullName: true, email: true } },
  store: { select: { id: true, name: true, code: true } },
  returnedVariant: {
    select: {
      id: true,
      barcode: true,
      size: true,
      color: true,
      product: { select: { name: true } },
    },
  },
  exchangeVariant: {
    select: {
      id: true,
      barcode: true,
      size: true,
      color: true,
      product: { select: { name: true } },
    },
  },
} as const;

function mapStatus(s: string): 'pending' | 'approved' | 'rejected' {
  if (s === 'pending' || s === 'approved' || s === 'rejected') return s;
  return 'pending';
}

function toRow(r: {
  id: string;
  requesterId: string;
  storeId: string;
  status: string;
  returnedVariantId: string;
  returnedQuantity: number;
  saleDate: Date;
  exchangeVariantId: string | null;
  reason: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  appliedReturnMovementId: string | null;
  appliedSaleMovementId: string | null;
  originalSaleId: string | null;
  originalSaleItemId: string | null;
  originalClosureDate: Date | null;
  originalPaymentMethod: 'cash' | 'card' | 'qr' | null;
  originalSubtotalCents: number | null;
  newPaymentMethod: 'cash' | 'card' | 'qr' | null;
  newSubtotalCents: number | null;
  createdAt: Date;
}): ReturnRequestRow {
  return {
    id: r.id,
    requesterId: r.requesterId,
    storeId: r.storeId,
    status: mapStatus(r.status),
    returnedVariantId: r.returnedVariantId,
    returnedQuantity: r.returnedQuantity,
    saleDate: r.saleDate,
    exchangeVariantId: r.exchangeVariantId,
    reason: r.reason,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    rejectionReason: r.rejectionReason,
    appliedReturnMovementId: r.appliedReturnMovementId,
    appliedSaleMovementId: r.appliedSaleMovementId,
    originalSaleId: r.originalSaleId,
    originalSaleItemId: r.originalSaleItemId,
    originalClosureDate: r.originalClosureDate,
    originalPaymentMethod: r.originalPaymentMethod,
    originalSubtotalCents: r.originalSubtotalCents,
    newPaymentMethod: r.newPaymentMethod,
    newSubtotalCents: r.newSubtotalCents,
    createdAt: r.createdAt,
  };
}

export function buildReturnRequestRepository(db: Database): ReturnRequestRepository {
  return {
    async findVariantByBarcode(barcode) {
      const v = await db.variant.findUnique({
        where: { barcode },
        select: { id: true },
      });
      return v ?? null;
    },

    async findStockBySite(variantId, storeId) {
      const s = await db.stockBySite.findUnique({
        where: { variantId_storeId: { variantId, storeId } },
        select: { quantity: true },
      });
      return s ?? null;
    },

    async findOriginalSaleItem(saleId, saleItemId, storeId) {
      const item = await db.saleItem.findUnique({
        where: { id: saleItemId },
        include: {
          sale: { select: { id: true, storeId: true } },
          variant: { select: { id: true, barcode: true } },
        },
      });
      if (!item) return null;
      if (item.saleId !== saleId) return null;
      if (item.sale.storeId !== storeId) return null;
      return {
        saleId: item.sale.id,
        saleItemId: item.id,
        storeId: item.sale.storeId,
        variantId: item.variant.id,
        variantBarcode: item.variant.barcode,
      };
    },

    async createReturnRequest(input) {
      const r = await db.returnRequest.create({
        data: {
          requesterId: input.requesterId,
          storeId: input.storeId,
          returnedVariantId: input.returnedVariantId,
          returnedQuantity: input.returnedQuantity,
          saleDate: input.saleDate,
          exchangeVariantId: input.exchangeVariantId ?? null,
          reason: input.reason,
          status: input.status,
          originalSaleId: input.originalSaleId ?? null,
          originalSaleItemId: input.originalSaleItemId ?? null,
          originalClosureDate: input.originalClosureDate ?? null,
          originalPaymentMethod: input.originalPaymentMethod
            ? PM_TO_PRISMA[input.originalPaymentMethod]
            : null,
          originalSubtotalCents: input.originalSubtotalCents ?? null,
          newPaymentMethod: input.newPaymentMethod ? PM_TO_PRISMA[input.newPaymentMethod] : null,
          newSubtotalCents: input.newSubtotalCents ?? null,
        },
        include: INCLUDE_FULL,
      });
      return toRow({
        ...r,
        originalPaymentMethod: r.originalPaymentMethod
          ? PM_FROM_PRISMA[r.originalPaymentMethod]
          : null,
        newPaymentMethod: r.newPaymentMethod ? PM_FROM_PRISMA[r.newPaymentMethod] : null,
      });
    },

    async findReturnRequestsByRequester(filter) {
      const statusFilter = filter.status
        ? { status: filter.status as 'pending' | 'approved' | 'rejected' }
        : {};

      const where = {
        requesterId: filter.requesterId,
        ...statusFilter,
      };

      const [rows, total] = await db.$transaction([
        db.returnRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
          include: INCLUDE_FULL,
        }),
        db.returnRequest.count({ where }),
      ]);

      return {
        rows: rows.map((r) =>
          toRow({
            ...r,
            originalPaymentMethod: r.originalPaymentMethod
              ? PM_FROM_PRISMA[r.originalPaymentMethod]
              : null,
            newPaymentMethod: r.newPaymentMethod ? PM_FROM_PRISMA[r.newPaymentMethod] : null,
          }),
        ),
        total,
      };
    },

    async findAllReturnRequests(filter) {
      const statusFilter = filter.status
        ? { status: filter.status as 'pending' | 'approved' | 'rejected' }
        : {};
      const storeFilter = filter.storeId ? { storeId: filter.storeId } : {};
      const requesterFilter = filter.requesterId ? { requesterId: filter.requesterId } : {};

      const where = {
        ...statusFilter,
        ...storeFilter,
        ...requesterFilter,
      };

      const [rows, total] = await db.$transaction([
        db.returnRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
          include: INCLUDE_FULL,
        }),
        db.returnRequest.count({ where }),
      ]);

      return {
        rows: rows.map((r) =>
          toRow({
            ...r,
            originalPaymentMethod: r.originalPaymentMethod
              ? PM_FROM_PRISMA[r.originalPaymentMethod]
              : null,
            newPaymentMethod: r.newPaymentMethod ? PM_FROM_PRISMA[r.newPaymentMethod] : null,
          }),
        ),
        total,
      };
    },

    async findReturnRequestById(id) {
      const r = await db.returnRequest.findUnique({
        where: { id },
        include: INCLUDE_FULL,
      });
      if (!r) return null;
      return toRow({
        ...r,
        originalPaymentMethod: r.originalPaymentMethod
          ? PM_FROM_PRISMA[r.originalPaymentMethod]
          : null,
        newPaymentMethod: r.newPaymentMethod ? PM_FROM_PRISMA[r.newPaymentMethod] : null,
      });
    },

    async approveReturnRequest(input) {
      const now = new Date();

      const result = await db.$transaction(async (tx) => {
        await tx.returnRequest.update({
          where: { id: input.id },
          data: {
            status: 'approved',
            reviewedBy: input.reviewerId,
            reviewedAt: now,
          },
        });

        // WHY: Wave 5 — when an originalSaleItemId is captured, REPLACE that
        //     SaleItem in place so the historical closure reflects the change.
        if (input.originalSaleItemId) {
          const updateData: Prisma.SaleItemUpdateInput = {};
          if (input.exchangeVariantId) {
            updateData.variant = { connect: { id: input.exchangeVariantId } };
          }
          if (typeof input.newSubtotalCents === 'number') {
            updateData.subtotalCents = input.newSubtotalCents;
          }
          await tx.saleItem.update({
            where: { id: input.originalSaleItemId },
            data: updateData,
          });
          // WHY: Wave 5 — when newPaymentMethod present, update the PARENT Sale's
          //     paymentMethod (Sale-level field, not per-item in current schema).
          //     Also recalculate Sale.totalCents so the daily report is correct.
          if (input.newPaymentMethod) {
            const item = await tx.saleItem.findUnique({
              where: { id: input.originalSaleItemId },
              select: { saleId: true },
            });
            if (item) {
              const itemSum = await tx.saleItem.aggregate({
                where: { saleId: item.saleId },
                _sum: { subtotalCents: true },
              });
              await tx.sale.update({
                where: { id: item.saleId },
                data: {
                  paymentMethod: PM_TO_PRISMA[input.newPaymentMethod],
                  totalCents: itemSum._sum.subtotalCents ?? 0,
                },
              });
            }
          }
        }

        // Use upsert to avoid crashes when the stock row doesn't exist (e.g. admin
        // manually zeroed it). Prefer incrementing if the row is already present.
        const paymentMethod = input.originalPaymentMethod ?? 'cash';
        const existingReturnStock = await tx.stockBySite.findUnique({
          where: {
            variantId_storeId: { variantId: input.returnedVariantId, storeId: input.storeId },
          },
          select: { id: true, quantity: true },
        });

        let balanceAfter: number;
        if (existingReturnStock) {
          const updated = await tx.stockBySite.update({
            where: { id: existingReturnStock.id },
            data: { quantity: { increment: input.returnedQuantity } },
            select: { quantity: true },
          });
          balanceAfter = updated.quantity;
        } else {
          const created = await tx.stockBySite.create({
            data: {
              variantId: input.returnedVariantId,
              storeId: input.storeId,
              quantity: input.returnedQuantity,
            },
            select: { quantity: true },
          });
          balanceAfter = created.quantity;
        }

        const returnMovement = await tx.stockMovement.create({
          data: {
            storeId: input.storeId,
            variantId: input.returnedVariantId,
            userId: input.reviewerId,
            type: 'sale_return',
            payload: {
              quantity: input.returnedQuantity,
              balanceAfter,
              paymentMethod,
              reason: 'Solicitud aprobada por admin',
              requestId: input.id,
            },
          },
        });

        let saleMovement = null;

        if (input.hasExchange && input.exchangeVariantId) {
          const existingExchangeStock = await tx.stockBySite.findUnique({
            where: {
              variantId_storeId: { variantId: input.exchangeVariantId, storeId: input.storeId },
            },
            select: { id: true, quantity: true },
          });

          let exchangeQuantity: number;
          if (existingExchangeStock) {
            const updated = await tx.stockBySite.update({
              where: { id: existingExchangeStock.id },
              data: { quantity: { decrement: input.returnedQuantity } },
              select: { quantity: true },
            });
            exchangeQuantity = updated.quantity;
          } else {
            // Defensive: create at 0 then decrement — prevents P2025 crash.
            const created = await tx.stockBySite.create({
              data: {
                variantId: input.exchangeVariantId,
                storeId: input.storeId,
                quantity: 0,
              },
              select: { id: true },
            });
            const updated = await tx.stockBySite.update({
              where: { id: created.id },
              data: { quantity: { decrement: input.returnedQuantity } },
              select: { quantity: true },
            });
            exchangeQuantity = updated.quantity;
          }

          saleMovement = await tx.stockMovement.create({
            data: {
              storeId: input.storeId,
              variantId: input.exchangeVariantId,
              userId: input.reviewerId,
              type: 'sale_out',
              payload: {
                quantity: input.returnedQuantity,
                balanceAfter: exchangeQuantity,
                paymentMethod,
                reason: 'Cambio aprobado',
                requestId: input.id,
              },
            },
          });
        }

        const final = await tx.returnRequest.update({
          where: { id: input.id },
          data: {
            appliedReturnMovementId: returnMovement.id,
            appliedSaleMovementId: saleMovement?.id ?? null,
          },
          include: INCLUDE_FULL,
        });

        return final;
      });

      return toRow({
        ...result,
        originalPaymentMethod: result.originalPaymentMethod
          ? PM_FROM_PRISMA[result.originalPaymentMethod]
          : null,
        newPaymentMethod: result.newPaymentMethod ? PM_FROM_PRISMA[result.newPaymentMethod] : null,
      });
    },

    async rejectReturnRequest(input) {
      const now = new Date();

      const r = await db.returnRequest.update({
        where: { id: input.id },
        data: {
          status: 'rejected',
          reviewedBy: input.reviewerId,
          reviewedAt: now,
          rejectionReason: input.rejectionReason,
        },
        include: INCLUDE_FULL,
      });

      return toRow({
        ...r,
        originalPaymentMethod: r.originalPaymentMethod
          ? PM_FROM_PRISMA[r.originalPaymentMethod]
          : null,
        newPaymentMethod: r.newPaymentMethod ? PM_FROM_PRISMA[r.newPaymentMethod] : null,
      });
    },

    async listClosuresWithSales({ storeIds, fromDate, toDate }) {
      // WHY: clamp window to last 7 days when not specified — picker shouldn't go further back.
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const rawLo = fromDate ?? sevenDaysAgo;
      const rawHi = toDate ?? now;

      // WHY: cuando FE manda fromDate=toDate=YYYY-MM-DD (single closure picker),
      // ambos parsean a midnight UTC y crean ventana de 1 segundo → 0 ventas.
      // Forzamos lo=startOfDay y hi=endOfDay para cubrir el día entero.
      const lo = new Date(rawLo);
      lo.setUTCHours(0, 0, 0, 0);
      const hi = new Date(rawHi);
      hi.setUTCHours(23, 59, 59, 999);

      const closures = await db.dailyReport.findMany({
        where: {
          storeId: { in: storeIds },
          date: {
            gte: new Date(lo.toISOString().slice(0, 10)),
            lte: new Date(hi.toISOString().slice(0, 10)),
          },
        },
        select: { id: true, storeId: true, date: true, closedAt: true },
        orderBy: { date: 'desc' },
      });

      const sales = await db.sale.findMany({
        where: {
          storeId: { in: storeIds },
          createdAt: { gte: lo, lte: hi },
        },
        include: {
          items: {
            include: {
              variant: { include: { product: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group sales by Bolivia-local date so a sale at 21:00 BOT (01:00 UTC)
      // correctly belongs to its actual calendar day. UTC grouping would put it
      // in the wrong daily closure.
      const dayKey = (d: Date): string => isoDateBolivia(d);

      const closureMap = new Map<string, { closureId: string | null; date: string }>();
      for (const c of closures) {
        const key = `${c.storeId}|${dayKey(c.date)}`;
        closureMap.set(key, { closureId: c.id, date: dayKey(c.date) });
      }

      // Group sales by (storeId, dayKey).
      const grouped = new Map<
        string,
        { closureDate: string; closureId: string | null; sales: ClosureSaleDTO[] }
      >();
      for (const s of sales) {
        const date = dayKey(s.createdAt);
        const key = `${s.storeId}|${date}`;
        const closureInfo = closureMap.get(key) ?? { closureId: null, date };
        let bucket = grouped.get(key);
        if (!bucket) {
          bucket = { closureDate: date, closureId: closureInfo.closureId, sales: [] };
          grouped.set(key, bucket);
        }
        bucket.sales.push({
          saleId: s.id,
          saleItems: s.items.map((it) => ({
            id: it.id,
            variantBarcode: it.variant.barcode,
            productName: it.variant.product.name,
            quantity: it.quantity,
            paymentMethod: PM_FROM_PRISMA[s.paymentMethod],
            subtotalCents: it.subtotalCents,
            totalCents: it.totalCents,
          })),
        });
      }

      return Array.from(grouped.values()).sort((a, b) => (a.closureDate < b.closureDate ? 1 : -1));
    },
  };
}
