import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateDeliveryPayload, ListDeliveriesFilters } from '@surmoda/contracts';
import { deliveriesQueryKeys, deliveriesService } from '../services/deliveriesService';
import { inventoryQueryKeys } from '@/features/inventory/services/inventoryService';

export function useDeliveriesGrouped(
  storeId: string | undefined,
  filters: ListDeliveriesFilters = {},
) {
  return useQuery({
    queryKey: storeId
      ? deliveriesQueryKeys.grouped(storeId, filters)
      : ['deliveries', 'grouped', 'noop'],
    queryFn: () => deliveriesService.listGrouped(storeId as string, filters),
    enabled: Boolean(storeId),
    placeholderData: (prev) => prev,
  });
}

export function useDelivery(deliveryId: string | undefined) {
  return useQuery({
    queryKey: deliveryId ? deliveriesQueryKeys.detail(deliveryId) : ['deliveries', 'detail', 'noop'],
    queryFn: () => deliveriesService.getById(deliveryId as string),
    enabled: Boolean(deliveryId),
  });
}

export function useCreateDelivery(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDeliveryPayload) => deliveriesService.create(storeId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveriesQueryKeys.all });
      // Stock changed too — invalidate inventory caches.
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.all });
    },
  });
}
