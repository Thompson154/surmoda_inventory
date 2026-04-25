import { httpClient } from '@/shared/services/httpClient';
import type {
  CreateDeliveryPayload,
  DeliveryWithItems,
  ListDeliveriesFilters,
  PaginatedDeliveries,
  PaginatedDeliveryGroups,
} from '@surmoda/contracts';

function buildQS(filters: ListDeliveriesFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const deliveriesService = {
  list: (storeId: string, filters: ListDeliveriesFilters = {}) =>
    httpClient.get<PaginatedDeliveries>(
      `/stores/${storeId}/deliveries${buildQS(filters)}`,
    ),
  listGrouped: (storeId: string, filters: ListDeliveriesFilters = {}) =>
    httpClient.get<PaginatedDeliveryGroups>(
      `/stores/${storeId}/deliveries/grouped${buildQS(filters)}`,
    ),
  getById: (deliveryId: string) =>
    httpClient.get<DeliveryWithItems>(`/deliveries/${deliveryId}`),
  create: (storeId: string, payload: CreateDeliveryPayload) =>
    httpClient.post<DeliveryWithItems>(`/stores/${storeId}/deliveries`, payload),
};

export const deliveriesQueryKeys = {
  all: ['deliveries'] as const,
  list: (storeId: string, filters: ListDeliveriesFilters) =>
    ['deliveries', 'list', storeId, filters] as const,
  grouped: (storeId: string, filters: ListDeliveriesFilters) =>
    ['deliveries', 'grouped', storeId, filters] as const,
  detail: (id: string) => ['deliveries', 'detail', id] as const,
};
