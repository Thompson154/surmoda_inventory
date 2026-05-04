import { useQuery } from '@tanstack/react-query';
import type {
  InventoryRow,
  ListInventoryFilters,
  PaginatedGroupedInventory,
} from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';
import { buildQueryString } from '@/shared/utils/buildQueryString';

const groupedKey = (storeId: string, filters: ListInventoryFilters) =>
  ['inventory', 'grouped', storeId, filters] as const;

const variantsKey = (storeId: string, productId: string) =>
  ['inventory', 'grouped', storeId, productId] as const;

function buildQS(filters: ListInventoryFilters): string {
  return buildQueryString({
    q: filters.q,
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

export function useInventoryGrouped(
  storeId: string | undefined,
  filters: ListInventoryFilters = {},
) {
  return useQuery({
    queryKey: storeId ? groupedKey(storeId, filters) : ['inventory', 'grouped', 'noop'],
    queryFn: () =>
      httpClient.get<PaginatedGroupedInventory>(
        `/stores/${storeId as string}/inventory/grouped${buildQS(filters)}`,
      ),
    enabled: Boolean(storeId),
    placeholderData: (prev) => prev,
  });
}

export function useInventoryProductVariants(
  storeId: string | undefined,
  productId: string | undefined,
) {
  return useQuery({
    queryKey:
      storeId && productId
        ? variantsKey(storeId, productId)
        : ['inventory', 'grouped', 'noop-variants'],
    queryFn: () =>
      httpClient.get<{ items: InventoryRow[] }>(
        `/stores/${storeId as string}/inventory/grouped/${productId as string}`,
      ),
    enabled: Boolean(storeId && productId),
  });
}
