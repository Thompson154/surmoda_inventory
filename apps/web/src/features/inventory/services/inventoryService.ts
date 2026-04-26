import type {
  AdjustQuantityPayload,
  InventoryRow,
  ListInventoryFilters,
  PaginatedInventory,
  PaginatedStockMovements,
  StoreEditPermissionDTO,
  TogglePermissionPayload,
} from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';

function buildQueryString(filters: ListInventoryFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.stockStatus) params.set('stockStatus', filters.stockStatus);
  if (filters.size) params.set('size', filters.size);
  if (filters.color) params.set('color', filters.color);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface AdjustResult extends InventoryRow {
  previous: number;
  delta: number;
}

export const inventoryService = {
  list: (storeId: string, filters: ListInventoryFilters = {}) =>
    httpClient.get<PaginatedInventory>(`/stores/${storeId}/inventory${buildQueryString(filters)}`),

  adjust: (storeId: string, variantId: string, payload: AdjustQuantityPayload) =>
    httpClient.patch<AdjustResult>(`/stores/${storeId}/inventory/${variantId}`, payload),

  getByBarcode: (storeId: string, barcode: string) =>
    httpClient.get<InventoryRow>(`/stores/${storeId}/inventory/by-barcode/${barcode}`),

  listMovements: (storeId: string, filters: { page?: number; pageSize?: number } = {}) =>
    httpClient.get<PaginatedStockMovements>(
      `/stores/${storeId}/movements${buildQueryString(filters)}`,
    ),

  getEditPermission: (storeId: string) =>
    httpClient.get<StoreEditPermissionDTO>(`/stores/${storeId}/edit-permission`),

  togglePermission: (storeId: string, payload: TogglePermissionPayload) =>
    httpClient.post<StoreEditPermissionDTO>(`/stores/${storeId}/edit-permission`, payload),
};

export const inventoryQueryKeys = {
  all: ['inventory'] as const,
  list: (storeId: string, filters: ListInventoryFilters) =>
    ['inventory', 'list', storeId, filters] as const,
  movements: (storeId: string, filters: { page?: number; pageSize?: number }) =>
    ['inventory', 'movements', storeId, filters] as const,
  permission: (storeId: string) => ['inventory', 'permission', storeId] as const,
};
