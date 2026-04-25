import { httpClient } from '@/shared/services/httpClient';
import type {
  CreateStorePayload,
  ListStoresFilters,
  PaginatedStores,
  Store,
  UpdateStorePayload,
} from '@surmoda/contracts';

function buildQueryString(filters: ListStoresFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters.includeInactive !== undefined) {
    params.set('includeInactive', String(filters.includeInactive));
  }
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const storesService = {
  list: (filters: ListStoresFilters = {}) =>
    httpClient.get<PaginatedStores>(`/stores${buildQueryString(filters)}`),
  getById: (id: string) => httpClient.get<Store>(`/stores/${id}`),
  create: (payload: CreateStorePayload) => httpClient.post<Store>('/stores', payload),
  update: (id: string, payload: UpdateStorePayload) =>
    httpClient.patch<Store>(`/stores/${id}`, payload),
  deactivate: (id: string) => httpClient.post<Store>(`/stores/${id}/deactivate`, undefined),
  reactivate: (id: string) => httpClient.post<Store>(`/stores/${id}/reactivate`, undefined),
};

export const storesQueryKeys = {
  all: ['stores'] as const,
  list: (filters: ListStoresFilters) => ['stores', 'list', filters] as const,
  detail: (id: string) => ['stores', 'detail', id] as const,
};
