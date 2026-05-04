import type { PaymentMethod } from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';

export interface CreateSaleReturnPayload {
  storeId: string;
  barcode: string;
  paymentMethod: PaymentMethod;
  reason?: string;
}

export interface SaleReturnResult {
  id: string;
  type: string;
}

export const saleReturnService = {
  create: (payload: CreateSaleReturnPayload) =>
    httpClient.post<SaleReturnResult>('/sales/returns', payload),
};
