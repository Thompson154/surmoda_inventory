import { httpClient } from '@/shared/services/httpClient';
import type {
  ConfirmDraftPayload,
  CreateDeliveryPayload,
  DeliveryWithItems,
  ListDeliveriesFilters,
  PaginatedDeliveries,
  PaginatedDeliveryGroups,
  ReceiveDeliveryPayload,
  UpdateDraftDeliveryPayload,
  WarehouseIntakeLookupResponse,
  WarehouseIntakePayload,
} from '@surmoda/contracts';

function buildQS(filters: ListDeliveriesFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) {
    const arr = Array.isArray(filters.status) ? filters.status : [filters.status];
    for (const s of arr) params.append('status', s);
  }
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
  updateDraft: (deliveryId: string, payload: UpdateDraftDeliveryPayload) =>
    httpClient.patch<DeliveryWithItems>(`/deliveries/${deliveryId}/draft`, payload),
  confirmDraft: (deliveryId: string, payload: ConfirmDraftPayload = {}) =>
    httpClient.post<DeliveryWithItems>(`/deliveries/${deliveryId}/confirm`, payload),
  receive: (deliveryId: string, payload: ReceiveDeliveryPayload) =>
    httpClient.post<DeliveryWithItems>(`/deliveries/${deliveryId}/receive`, payload),
  intakeLookup: (warehouseId: string, code: string) =>
    httpClient.get<WarehouseIntakeLookupResponse>(
      `/stores/${warehouseId}/deliveries/intake/lookup?code=${encodeURIComponent(code)}`,
    ),
  intake: (warehouseId: string, payload: WarehouseIntakePayload) =>
    httpClient.post<DeliveryWithItems>(`/stores/${warehouseId}/deliveries/intake`, payload),
};

export const deliveriesQueryKeys = {
  all: ['deliveries'] as const,
  list: (storeId: string, filters: ListDeliveriesFilters) =>
    ['deliveries', 'list', storeId, filters] as const,
  grouped: (storeId: string, filters: ListDeliveriesFilters) =>
    ['deliveries', 'grouped', storeId, filters] as const,
  detail: (id: string) => ['deliveries', 'detail', id] as const,
};
