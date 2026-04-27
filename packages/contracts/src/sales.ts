// WHY: shared sales contracts — single source of truth for FE/BE.

import type { Size } from './products';

export type PaymentMethod = 'qr' | 'card' | 'cash';

export interface SaleItemPayload {
  variantId: string;
  quantity: number;
  /** Charged amount for this line (cents). Optional — defaults to quantity*priceAtSale on the BE. */
  subtotalCents?: number;
}

export interface CreateSalePayload {
  items: SaleItemPayload[];
  paymentMethod: PaymentMethod;
  /**
   * Tier 3.A.3 — idempotency key. The FE generates a UUID v4 once per
   * checkout attempt. If the network drops between request-sent and
   * response-received and the FE retries the same payload, the BE returns
   * the originally-created sale instead of inserting a second row. The key
   * is bound to (storeId, key) at the DB so two stores can technically
   * reuse the same UUID without colliding.
   *
   * Optional today (back-compat with FE versions that don't send it yet).
   * Will become required after every FE caller adopts it.
   */
  idempotencyKey?: string;
}

export interface SaleItemDTO {
  id: string;
  variantId: string;
  quantity: number;
  priceAtSaleCents: number;
  /** Final cobrado for this line (cents). Equals quantity*priceAtSaleCents when no discount applied. */
  subtotalCents: number;
  productId: string;
  productCode: string;
  productName: string;
  size: Size;
  color: string;
  barcode: string;
  imagePath?: string | null;
}

export interface SaleDTO {
  id: string;
  storeId: string;
  storeName: string;
  recordedByUserId: string;
  recordedByFullName: string;
  paymentMethod: PaymentMethod;
  totalCents: number;
  itemCount: number;
  totalUnits: number;
  createdAt: string;
}

export interface SaleWithItems extends SaleDTO {
  items: SaleItemDTO[];
}

export interface PaginatedSales {
  /** List endpoint eager-loads items so per-item rendering is possible without N+1. */
  items: SaleWithItems[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListSalesFilters {
  page?: number;
  pageSize?: number;
}

export interface DailyBreakdownRow {
  /** ISO date (YYYY-MM-DD) of the day in store-local timezone (Bolivia, UTC-4). */
  date: string;
  qrCents: number;
  cardCents: number;
  cashCents: number;
  totalCents: number;
}

export interface WeeklyBreakdownRow {
  /** ISO date of Monday of the week (UTC-4). */
  weekStart: string;
  /** ISO date of Sunday of the week (UTC-4). */
  weekEnd: string;
  qrCents: number;
  cardCents: number;
  cashCents: number;
  totalCents: number;
}

export interface SalesDashboard {
  todayCents: number;
  yesterdayCents: number;
  /** Percentage delta vs yesterday (todayCents - yesterdayCents)/yesterdayCents * 100. */
  deltaPct: number | null;
  weekCents: number;
  transactionsCount: number;
  averageTicketCents: number;
  /** Last 7 days, oldest → newest, [{ date, totalCents }]. */
  last7Days: Array<{ date: string; totalCents: number }>;
  /** Last 5 days breakdown (per-method + total). */
  dailyBreakdown: DailyBreakdownRow[];
  /** Last 4 weeks breakdown. */
  weeklyBreakdown: WeeklyBreakdownRow[];
}
