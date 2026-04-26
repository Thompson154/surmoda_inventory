import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConfirmDraftPayload,
  CreateDeliveryPayload,
  ListDeliveriesFilters,
  ReceiveDeliveryPayload,
  UpdateDraftDeliveryPayload,
} from '@surmoda/contracts';
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

/** List deliveries with full status filter support — used by the new
 *  Pendientes / Parciales / Recibidas tabbed list. */
export function useDeliveriesList(
  storeId: string | undefined,
  filters: ListDeliveriesFilters = {},
) {
  return useQuery({
    queryKey: storeId
      ? deliveriesQueryKeys.list(storeId, filters)
      : ['deliveries', 'list', 'noop'],
    queryFn: () => deliveriesService.list(storeId as string, filters),
    enabled: Boolean(storeId),
    placeholderData: (prev) => prev,
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

export function useUpdateDraftDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deliveryId, payload }: { deliveryId: string; payload: UpdateDraftDeliveryPayload }) =>
      deliveriesService.updateDraft(deliveryId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveriesQueryKeys.all });
    },
  });
}

export function useConfirmDraftDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deliveryId, payload }: { deliveryId: string; payload?: ConfirmDraftPayload }) =>
      deliveriesService.confirmDraft(deliveryId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveriesQueryKeys.all });
    },
  });
}

export function useReceiveDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deliveryId, payload }: { deliveryId: string; payload: ReceiveDeliveryPayload }) =>
      deliveriesService.receive(deliveryId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveriesQueryKeys.all });
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.all });
    },
  });
}
