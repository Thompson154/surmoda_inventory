// useStores — TEMPORARY hardcoded list until feature 002 (Stores) ships.
// WHY: centralizing the seed-store IDs in ONE place so swapping to a real
// `GET /api/v1/stores` endpoint is a single-file change.
// NOTE: this is the ONLY place that should reference store IDs by literal string.
// Both UserForm and AssignmentsManager consume `useStores()` — never inline.

export interface StoreOption {
  id: string;
  label: string;
}

const SEED_STORES: StoreOption[] = [
  { id: 'store-prado-seed', label: 'Prado' },
  { id: 'store-zsur-seed', label: 'Z. Sur' },
  { id: 'store-almacen-seed', label: 'Almacén' },
];

export function useStores(): { data: StoreOption[]; isLoading: boolean } {
  return { data: SEED_STORES, isLoading: false };
}

export function getStoreLabel(storeId: string): string {
  return SEED_STORES.find((s) => s.id === storeId)?.label ?? storeId;
}
