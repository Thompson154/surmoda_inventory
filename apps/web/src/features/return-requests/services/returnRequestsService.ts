import type {
  ClosureWithSales,
  CreateReturnRequestPayload,
  ListReturnRequestsFilters,
  PaginatedReturnRequests,
  ReturnRequest,
} from '../types';
import { httpClient } from '@/shared/services/httpClient';

function buildQS(filters: ListReturnRequestsFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const returnRequestsService = {
  create: (payload: CreateReturnRequestPayload) =>
    httpClient.post<ReturnRequest>('/return-requests', payload),

  listMine: (filters: ListReturnRequestsFilters) =>
    httpClient.get<PaginatedReturnRequests>(`/return-requests/mine${buildQS(filters)}`),

  listAdmin: (filters: ListReturnRequestsFilters) =>
    httpClient.get<PaginatedReturnRequests>(`/return-requests${buildQS(filters)}`),

  getById: (id: string) => httpClient.get<ReturnRequest>(`/return-requests/${id}`),

  approve: (id: string) => httpClient.post<ReturnRequest>(`/return-requests/${id}/approve`),

  reject: (id: string, rejectionReason: string) =>
    httpClient.post<ReturnRequest>(`/return-requests/${id}/reject`, { rejectionReason }),

  getClosuresWithSales: (storeId: string, fromDate: string, toDate: string) =>
    httpClient.get<ClosureWithSales[]>(
      `/return-requests/closures-with-sales?storeId=${encodeURIComponent(storeId)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`,
    ),
};

export const returnRequestsQueryKeys = {
  all: ['return-requests'] as const,
  mine: (filters: ListReturnRequestsFilters) => ['return-requests', 'mine', filters] as const,
  admin: (filters: ListReturnRequestsFilters) => ['return-requests', 'admin', filters] as const,
  detail: (id: string) => ['return-requests', 'detail', id] as const,
  closures: (storeId: string, fromDate: string, toDate: string) =>
    ['return-requests', 'closures', storeId, fromDate, toDate] as const,
};
