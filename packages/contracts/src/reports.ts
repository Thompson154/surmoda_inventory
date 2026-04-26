// Cross-store admin analytics. Reads cierre snapshots (DailyReport) for any
// date < today and runtime sales for today, then aggregates to a single DTO.
//
// Audience: admin OR any encargada (global). Vendedora is forbidden.

export interface ReportRangeFilter {
  /** Inclusive YYYY-MM-DD lower bound. Bolivia local. */
  from: string;
  /** Inclusive YYYY-MM-DD upper bound. Bolivia local. */
  to: string;
}

export interface ReportTotalsDTO {
  totalCents: number;
  qrCents: number;
  cardCents: number;
  cashCents: number;
  transactionsCount: number;
  itemCount: number;
  /** Average cobrado per transaction. Zero when no transactions in range. */
  averageTicketCents: number;
  /**
   * Total discount applied across all sales in the range, in cents. Computed as
   * sum of (priceAtSaleCents * quantity - subtotalCents) per sale_item — i.e.
   * the difference between catalog price and what the cashier actually charged.
   */
  discountCents: number;
}

export interface ReportStoreRowDTO {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalCents: number;
  transactionsCount: number;
}

export interface ReportTopProductDTO {
  variantId: string;
  productCode: string;
  productName: string;
  size: string;
  color: string;
  quantitySold: number;
  totalCents: number;
}

export interface ReportTopSellerDTO {
  userId: string;
  fullName: string;
  transactionsCount: number;
  totalCents: number;
}

export interface ReportSummaryDTO {
  range: ReportRangeFilter;
  totals: ReportTotalsDTO;
  byStore: ReportStoreRowDTO[];
  topProducts: ReportTopProductDTO[];
  topSellers: ReportTopSellerDTO[];
}
