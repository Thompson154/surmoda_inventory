// Shared types for the sales report feature (POST /api/v1/reports/sales).
// Backend preserves cents in preview JSON; the FE formats them via formatBs().

export interface GenerateReportArgs {
  storeId: string;
  from: string; // ISO 8601 datetime with timezone (e.g. 2026-04-27T00:00:00.000Z)
  to: string; // ISO 8601 datetime with timezone (e.g. 2026-04-27T23:59:59.999Z)
  includePaymentSummary?: boolean;
  includeInventory?: boolean;
}

export interface SalesRow {
  saleDate: string;
  saleTime: string;
  ticketNumber: string;
  productCode: string;
  variantDescription: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  paymentMethod: string;
  cashier: string;
}

export interface PaymentSummary {
  cash: number;
  card: number;
  qr: number;
  total: number;
}

export interface InventoryRow {
  productCode: string;
  variantDescription: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
}

export interface InventorySection {
  rows: InventoryRow[];
  totalVariants: number;
  totalUnits: number;
  capturedAt: string;
}

export interface SalesSection {
  rows: SalesRow[];
  totalRows: number;
  totalAmountCents: number;
}

export interface SalesReportPreview {
  store: { id: string; name: string; code: string };
  period: { from: string; to: string };
  sales: SalesSection;
  paymentSummary?: PaymentSummary;
  inventory?: InventorySection;
  generatedAt: string;
}
