import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdjustQuantityPayload,
  ListInventoryFilters,
  TogglePermissionPayload,
} from '@surmoda/contracts';
import { inventoryQueryKeys, inventoryService } from '../services/inventoryService';

// Tier 3.B.16 — periodic refetch so two cashiers at the same store see each
// other's stock changes within ~10s without needing a websocket. Cheap on
// our scale (5 stores × 5-15 concurrent users); React Query dedupes inflight
// requests so navigating between tabs doesn't multiply the polling.
const INVENTORY_REFETCH_MS = 10_000;

export function useInventory(storeId: string | undefined, filters: ListInventoryFilters = {}) {
  return useQuery({
    queryKey: storeId ? inventoryQueryKeys.list(storeId, filters) : ['inventory', 'list', 'noop'],
    queryFn: () => inventoryService.list(storeId as string, filters),
    enabled: Boolean(storeId),
    placeholderData: (prev) => prev,
    refetchInterval: INVENTORY_REFETCH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useStockMovements(storeId: string | undefined, page: number, pageSize = 20) {
  return useQuery({
    queryKey: storeId
      ? inventoryQueryKeys.movements(storeId, { page, pageSize })
      : ['inventory', 'movements', 'noop'],
    queryFn: () => inventoryService.listMovements(storeId as string, { page, pageSize }),
    enabled: Boolean(storeId),
    // Movements is the audit feed — staleTime:0 + refetchOnMount:'always' so
    // every drawer open shows the absolute latest entries. Without this the
    // Provider-level staleTime:30_000 made the drawer reuse cached data after
    // a stock adjust, so the just-recorded movement didn't appear until the
    // user reloaded the page. invalidateQueries from useAdjustQuantity is
    // still the primary path; this is the belt-and-suspenders that handles
    // the cold-reopen case where the component remounts with a stale cache.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: storeId ? INVENTORY_REFETCH_MS : false,
    refetchIntervalInBackground: false,
  });
}

export function useEditPermission(storeId: string | undefined) {
  return useQuery({
    queryKey: storeId
      ? inventoryQueryKeys.permission(storeId)
      : ['inventory', 'permission', 'noop'],
    queryFn: () => inventoryService.getEditPermission(storeId as string),
    enabled: Boolean(storeId),
  });
}

export function useAdjustQuantity(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, payload }: { variantId: string; payload: AdjustQuantityPayload }) =>
      inventoryService.adjust(storeId, variantId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.all });
    },
  });
}

export function useToggleEditPermission(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TogglePermissionPayload) =>
      inventoryService.togglePermission(storeId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.permission(storeId) });
    },
  });
}
