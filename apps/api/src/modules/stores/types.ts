import type {
  Store as StoreContract,
  CreateStorePayload,
  UpdateStorePayload,
  ListStoresFilters,
  PaginatedStores as PaginatedStoresContract,
  StoreKind as StoreKindContract,
} from '@surmoda/contracts';

export type StoreDTO = StoreContract;
export type StoreKind = StoreKindContract;
export type CreateStoreDTO = CreateStorePayload;
export type UpdateStoreDTO = UpdateStorePayload;
export type ListStoresFiltersDTO = ListStoresFilters;
export type PaginatedStores = PaginatedStoresContract;

// WHY: BE-specific — page/pageSize REQUIRED here (Zod defaults them upstream).
export interface ListStoresQuery {
  q?: string;
  kind?: StoreKind;
  isActive?: boolean;
  includeInactive?: boolean;
  page: number;
  pageSize: number;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
