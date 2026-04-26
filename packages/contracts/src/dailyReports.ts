// WHY: shared contracts for the daily-close report (feature 007).

export interface DailyReportAttendeeDTO {
  userId: string;
  fullName: string;
}

export interface DailyReportDTO {
  id: string;
  storeId: string;
  /** Local Bolivia day in YYYY-MM-DD. */
  date: string;
  totalCents: number;
  qrCents: number;
  cardCents: number;
  cashCents: number;
  itemCount: number;
  transactionsCount: number;
  closedByUserId: string | null;
  closedByFullName: string | null;
  closedAt: string;
  autoClosed: boolean;
  /** Manually-recorded staff present on the floor that day. */
  attendees: DailyReportAttendeeDTO[];
}

export interface CloseDayPayload {
  /** User IDs of staff that worked the day. May be empty for legacy clients. */
  attendedUserIds: string[];
}

export interface StoreStaffMember {
  userId: string;
  fullName: string;
  role: 'encargada' | 'vendedora';
}

export interface PaginatedDailyReports {
  items: DailyReportDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListDailyReportsFilters {
  /** Inclusive YYYY-MM-DD lower bound. */
  from?: string;
  /** Inclusive YYYY-MM-DD upper bound. */
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface DailyReportItemDTO {
  variantId: string;
  productCode: string;
  productName: string;
  size: string;
  color: string;
  barcode: string;
  quantity: number;
  totalCents: number;
}

export interface DailyReportItemsDTO {
  date: string;
  items: DailyReportItemDTO[];
}
