import { useQuery } from '@tanstack/react-query';
import type { ListProductsFilters } from '@surmoda/contracts';
import { productsQueryKeys, productsService } from '../services/productsService';

const STALE_MS = 30_000;

export function useProducts(filters: ListProductsFilters = {}) {
  return useQuery({
    queryKey: productsQueryKeys.list(filters),
    queryFn: () => productsService.list(filters),
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: id ? productsQueryKeys.detail(id) : ['products', 'detail', 'noop'],
    queryFn: () => productsService.getById(id as string),
    enabled: Boolean(id),
  });
}
