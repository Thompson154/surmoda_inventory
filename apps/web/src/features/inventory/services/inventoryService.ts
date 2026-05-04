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
import { buildQueryString } from '@/shared/utils/buildQueryString';

function buildInventoryQS(filters: ListInventoryFilters): string {
  return buildQueryString({
    q: filters.q,
    stockStatus: filters.stockStatus,
    size: filters.size,
    color: filters.color,
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

export interface AdjustResult extends InventoryRow {
  previous: number;
  delta: number;
}

export const inventoryService = {
  list: (storeId: string, filters: ListInventoryFilters = {}) =>
    httpClient.get<PaginatedInventory>(`/stores/${storeId}/inventory${buildInventoryQS(filters)}`),

  adjust: (storeId: string, variantId: string, payload: AdjustQuantityPayload) =>
    httpClient.patch<AdjustResult>(`/stores/${storeId}/inventory/${variantId}`, payload),

  getByBarcode: (storeId: string, barcode: string) =>
    httpClient.get<InventoryRow>(`/stores/${storeId}/inventory/by-barcode/${barcode}`),

  listMovements: (storeId: string, filters: { page?: number; pageSize?: number } = {}) =>
    httpClient.get<PaginatedStockMovements>(
      `/stores/${storeId}/movements${buildInventoryQS(filters)}`,
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
