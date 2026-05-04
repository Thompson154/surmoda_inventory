export type ReturnRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ReturnRequest {
  id: string;
  storeId: string;
  storeName: string;
  requestedById: string;
  requestedByFullName: string;
  returnedVariantBarcode: string;
  returnedVariantDescription?: string;
  returnedVariantImagePath?: string | null;
  exchangeVariantBarcode?: string | null;
  exchangeVariantDescription?: string | null;
  quantity: number;
  saleDate: string;
  reason: string;
  status: ReturnRequestStatus;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  reviewedByFullName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface CreateReturnRequestPayload {
  storeId: string;
  returnedVariantBarcode: string;
  /** @deprecated use returnedQuantity — kept for backward compat with scanner modal */
  quantity?: number;
  returnedQuantity?: number;
  saleDate: string;
  exchangeVariantBarcode?: string;
  reason: string;
  // Wave 5 — original sale identification block (all-or-nothing, optional per BE refinement)
  originalSaleId?: string;
  originalSaleItemId?: string;
  originalClosureDate?: string;
  originalPaymentMethod?: 'cash' | 'card' | 'qr';
  originalSubtotalCents?: number;
  newPaymentMethod?: 'cash' | 'card' | 'qr';
  newSubtotalCents?: number;
}

export type PaymentMethod = 'cash' | 'card' | 'qr';

export interface ClosureSaleItem {
  id: string;
  variantBarcode: string;
  productName: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  subtotalCents: number;
  totalCents: number;
}

export interface ClosureSale {
  saleId: string;
  saleItems: ClosureSaleItem[];
}

export interface ClosureWithSales {
  closureDate: string;
  closureId: string;
  sales: ClosureSale[];
}

export interface ApproveReturnRequestPayload {
  id: string;
}

export interface RejectReturnRequestPayload {
  id: string;
  rejectionReason: string;
}

export interface ListReturnRequestsFilters {
  status?: ReturnRequestStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface PaginatedReturnRequests {
  items: ReturnRequest[];
  total: number;
  page: number;
  pageSize: number;
}
