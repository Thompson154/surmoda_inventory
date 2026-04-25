import { useQuery } from '@tanstack/react-query';
import type { ListStoresFilters } from '@surmoda/contracts';
import { storesQueryKeys, storesService } from '../services/storesService';

const STORES_STALE_TIME_MS = 60_000;

export function useStores(filters: ListStoresFilters = {}) {
  return useQuery({
    queryKey: storesQueryKeys.list(filters),
    queryFn: () => storesService.list(filters),
    staleTime: STORES_STALE_TIME_MS,
    placeholderData: (prev) => prev,
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: id ? storesQueryKeys.detail(id) : ['stores', 'detail', 'noop'],
    queryFn: () => storesService.getById(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Resolves a store name from the cached active-stores list.
 * Falls back to the storeId during the first render before cache is warm.
 */
export function useStoreLabel(storeId: string): string {
  const { data } = useStores();
  return data?.items.find((s) => s.id === storeId)?.name ?? storeId;
}
