import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateStorePayload, Store, UpdateStorePayload } from '@surmoda/contracts';
import { storesQueryKeys, storesService } from '../services/storesService';

function useInvalidateStores() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: storesQueryKeys.all });
}

export function useCreateStore(options?: { onSuccess?: (store: Store) => void }) {
  const invalidate = useInvalidateStores();
  return useMutation({
    mutationFn: (payload: CreateStorePayload) => storesService.create(payload),
    onSuccess: (store) => {
      void invalidate();
      options?.onSuccess?.(store);
    },
  });
}

export function useUpdateStore(id: string) {
  const invalidate = useInvalidateStores();
  return useMutation({
    mutationFn: (payload: UpdateStorePayload) => storesService.update(id, payload),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useDeactivateStore(id: string) {
  const invalidate = useInvalidateStores();
  return useMutation({
    mutationFn: () => storesService.deactivate(id),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useReactivateStore(id: string) {
  const invalidate = useInvalidateStores();
  return useMutation({
    mutationFn: () => storesService.reactivate(id),
    onSuccess: () => {
      void invalidate();
    },
  });
}
