// Types for the POST /api/v1/reports/sales endpoint.
// These are backend-internal; they do NOT live in @surmoda/contracts because the
// report endpoint is not consumed by the public FE contract layer.

import type { AuthContext } from '../../shared/auth/storeScope';

export type { AuthContext };

// ─── Input ────────────────────────────────────────────────────────────────────

export interface GenerateSalesReportArgs {
  requestingUser: AuthContext;
  storeId: string;
  from: Date;
  to: Date;
  includePaymentSummary: boolean;
  includeInventory: boolean;
}

export interface StreamSalesReportXlsxArgs extends GenerateSalesReportArgs {
  stream: NodeJS.WritableStream;
}

// ─── Row shapes ───────────────────────────────────────────────────────────────

export interface SalesRow {
  saleDate: string; // ISO date (YYYY-MM-DD)
  saleTime: string; // HH:mm:ss
  ticketNumber: string; // saleId (no separate ticket field in schema)
  productCode: string;
  variantDescription: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  paymentMethod: string; // 'cash' | 'card' | 'qr'
  cashier: string; // fullName of User who recorded the sale
}

export interface InventoryRow {
  productCode: string;
  variantDescription: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
}

// ─── Section shapes ───────────────────────────────────────────────────────────

export interface StoreInfo {
  id: string;
  name: string;
  code: string;
}

export interface PaymentSummary {
  cash: number;
  card: number;
  qr: number;
  total: number;
}

export interface InventorySection {
  rows: InventoryRow[];
  totalVariants: number;
  totalUnits: number;
  capturedAt: Date;
}

export interface SalesSection {
  rows: SalesRow[];
  totalRows: number;
  totalAmountCents: number;
}

// ─── Report result ────────────────────────────────────────────────────────────

export interface SalesReportResult {
  store: StoreInfo;
  period: { from: Date; to: Date };
  sales: SalesSection;
  paymentSummary?: PaymentSummary;
  inventory?: InventorySection;
  generatedAt: Date;
}
