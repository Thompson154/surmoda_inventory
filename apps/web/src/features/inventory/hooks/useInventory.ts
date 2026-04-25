import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdjustQuantityPayload,
  ListInventoryFilters,
  TogglePermissionPayload,
} from '@surmoda/contracts';
import { inventoryQueryKeys, inventoryService } from '../services/inventoryService';

export function useInventory(storeId: string | undefined, filters: ListInventoryFilters = {}) {
  return useQuery({
    queryKey: storeId ? inventoryQueryKeys.list(storeId, filters) : ['inventory', 'list', 'noop'],
    queryFn: () => inventoryService.list(storeId as string, filters),
    enabled: Boolean(storeId),
    placeholderData: (prev) => prev,
  });
}

export function useStockMovements(storeId: string | undefined, page: number, pageSize = 20) {
  return useQuery({
    queryKey: storeId
      ? inventoryQueryKeys.movements(storeId, { page, pageSize })
      : ['inventory', 'movements', 'noop'],
    queryFn: () => inventoryService.listMovements(storeId as string, { page, pageSize }),
    enabled: Boolean(storeId),
  });
}

export function useEditPermission(storeId: string | undefined) {
  return useQuery({
    queryKey: storeId ? inventoryQueryKeys.permission(storeId) : ['inventory', 'permission', 'noop'],
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
