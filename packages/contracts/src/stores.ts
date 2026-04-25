// WHY: shared store contracts — single source of truth for FE/BE.
// Mirrors Prisma `StoreKind` enum + `Store` model without leaking Prisma types.

export type StoreKind = 'warehouse' | 'branch';

export interface Store {
  id: string;
  code: string;
  name: string;
  kind: StoreKind;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStorePayload {
  code: string;
  name: string;
  kind: StoreKind;
}

// WHY: `kind` intentionally omitted — kind immutability is enforced (FR-8).
export interface UpdateStorePayload {
  code?: string;
  name?: string;
}

export interface ListStoresFilters {
  q?: string;
  kind?: StoreKind;
  isActive?: boolean;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedStores {
  items: Store[];
  total: number;
  page: number;
  pageSize: number;
}
