import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSalePayload, ListSalesFilters } from '@surmoda/contracts';
import { salesQueryKeys, salesService } from '../services/salesService';
import { inventoryQueryKeys } from '@/features/inventory/services/inventoryService';

export function useSales(storeId: string | undefined, filters: ListSalesFilters = {}) {
  return useQuery({
    queryKey: storeId ? salesQueryKeys.list(storeId, filters) : ['sales', 'list', 'noop'],
    queryFn: () => salesService.list(storeId as string, filters),
    enabled: Boolean(storeId),
    placeholderData: (prev) => prev,
  });
}

export function useSalesDashboard(storeId: string | undefined) {
  return useQuery({
    queryKey: storeId ? salesQueryKeys.dashboard(storeId) : ['sales', 'dashboard', 'noop'],
    queryFn: () => salesService.dashboard(storeId as string),
    enabled: Boolean(storeId),
  });
}

export function useCreateSale(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSalePayload) => salesService.create(storeId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesQueryKeys.all });
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.all });
    },
  });
}
