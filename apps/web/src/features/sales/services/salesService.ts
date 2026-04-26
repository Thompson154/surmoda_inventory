import type {
  CreateSalePayload,
  ListSalesFilters,
  PaginatedSales,
  SaleWithItems,
  SalesDashboard,
} from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';

function buildQS(filters: ListSalesFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const salesService = {
  list: (storeId: string, filters: ListSalesFilters = {}) =>
    httpClient.get<PaginatedSales>(`/stores/${storeId}/sales${buildQS(filters)}`),
  getById: (storeId: string, saleId: string) =>
    httpClient.get<SaleWithItems>(`/stores/${storeId}/sales/${saleId}`),
  create: (storeId: string, payload: CreateSalePayload) =>
    httpClient.post<SaleWithItems>(`/stores/${storeId}/sales`, payload),
  dashboard: (storeId: string) =>
    httpClient.get<SalesDashboard>(`/stores/${storeId}/sales/dashboard`),
};

export const salesQueryKeys = {
  all: ['sales'] as const,
  list: (storeId: string, filters: ListSalesFilters) =>
    ['sales', 'list', storeId, filters] as const,
  detail: (storeId: string, saleId: string) => ['sales', 'detail', storeId, saleId] as const,
  dashboard: (storeId: string) => ['sales', 'dashboard', storeId] as const,
};
