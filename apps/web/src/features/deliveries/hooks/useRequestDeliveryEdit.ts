import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deliveryEditRequestService,
  type CreateDeliveryEditRequestPayload,
} from '../services/deliveryEditRequestService';
import { deliveriesQueryKeys } from '../services/deliveriesService';

export function useRequestDeliveryEdit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      deliveryId,
      payload,
    }: {
      deliveryId: string;
      payload: CreateDeliveryEditRequestPayload;
    }) => deliveryEditRequestService.create(deliveryId, payload),
    onSuccess: () => {
      // WHY: refresh all deliveries so status/state is up to date
      void qc.invalidateQueries({ queryKey: deliveriesQueryKeys.all });
    },
  });
}
