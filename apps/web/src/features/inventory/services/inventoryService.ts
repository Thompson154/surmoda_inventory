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

export type InventorySearchResolution =
  | { kind: 'exact_barcode'; row: InventoryRow }
  | { kind: 'variants'; rows: InventoryRow[] }
  | { kind: 'not_found' };

export const inventoryService = {
  list: (storeId: string, filters: ListInventoryFilters = {}) =>
    httpClient.get<PaginatedInventory>(`/stores/${storeId}/inventory${buildInventoryQS(filters)}`),

  adjust: (storeId: string, variantId: string, payload: AdjustQuantityPayload) =>
    httpClient.patch<AdjustResult>(`/stores/${storeId}/inventory/${variantId}`, payload),

  getByBarcode: (storeId: string, barcode: string) =>
    httpClient.get<InventoryRow>(
      `/stores/${storeId}/inventory/by-barcode/${encodeURIComponent(barcode)}`,
    ),

  resolveCodeOrSearch: async (
    storeId: string,
    rawQuery: string,
  ): Promise<InventorySearchResolution> => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return { kind: 'not_found' };
    try {
      const row = await inventoryService.getByBarcode(storeId, trimmed);
      return { kind: 'exact_barcode', row };
    } catch (err) {
      const e = err as { code?: string; status?: number };
      if (e.code !== 'STOCK_BARCODE_NOT_FOUND' && e.status !== 404) {
        throw err;
      }
      const res = await inventoryService.list(storeId, { q: trimmed, page: 1, pageSize: 30 });
      if (res.items.length === 0) return { kind: 'not_found' };
      const upper = trimmed.toUpperCase();
      const exactProduct = res.items.filter((r) => r.productCode.toUpperCase() === upper);
      return { kind: 'variants', rows: exactProduct.length > 0 ? exactProduct : res.items };
    }
  },

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
