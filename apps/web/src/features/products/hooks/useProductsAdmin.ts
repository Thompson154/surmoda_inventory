import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateProductPayload, Product, UpdateProductPayload } from '@surmoda/contracts';
import {
  productsQueryKeys,
  productsService,
  type CreateVariantArgs,
  type UpdateVariantArgs,
} from '../services/productsService';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: productsQueryKeys.all });
}

export function useCreateProduct(options?: { onSuccess?: (product: Product) => void }) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => productsService.create(payload),
    onSuccess: (created) => {
      void invalidate();
      options?.onSuccess?.(created);
    },
  });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: UpdateProductPayload) => productsService.update(id, payload),
    onSuccess: () => void invalidate(),
  });
}

export function useDeactivateProduct(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => productsService.deactivate(id),
    onSuccess: () => void invalidate(),
  });
}

export function useReactivateProduct(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => productsService.reactivate(id),
    onSuccess: () => void invalidate(),
  });
}

export function useCreateVariant(productId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: CreateVariantArgs) => productsService.createVariant(productId, args),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateVariant(variantId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: UpdateVariantArgs) => productsService.updateVariant(variantId, args),
    onSuccess: () => void invalidate(),
  });
}

export function useDeactivateVariant(variantId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => productsService.deactivateVariant(variantId),
    onSuccess: () => void invalidate(),
  });
}

export function useReactivateVariant(variantId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => productsService.reactivateVariant(variantId),
    onSuccess: () => void invalidate(),
  });
}
