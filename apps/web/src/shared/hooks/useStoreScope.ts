import { useAuthStore } from '@/features/auth/stores/useAuthStore';

export interface StoreScope {
  /** Root admin. */
  isAdmin: boolean;
  /** Holds at least one assignment with role=encargada → operates as a global
   *  encargada (sees every store, opens every cierre) per the post-feature-004
   *  product decision. */
  hasEncargadaRole: boolean;
  /** Direct role on the requested store (or null if no assignment there). */
  directRole: 'encargada' | 'vendedora' | null;
  /** True when the user is admin OR encargada-anywhere — they manage everything. */
  canManage: boolean;
  /** True only when the user is a plain vendedora here (no admin, no global
   *  encargada role, direct vendedora assignment on this store). */
  isVendedoraHere: boolean;
}

/**
 * Single source of truth for "what can the current user do at this store?".
 * Replaces the `isAdmin / hasEncargadaRole / directRole / isVendedoraHere`
 * tuple that every store-scoped page used to recompute by hand.
 */
export function useStoreScope(storeId: string | null): StoreScope {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.isAdmin ?? false;
  const assignments = user?.assignments ?? [];
  const hasEncargadaRole = assignments.some((a) => a.role === 'encargada');
  const directRole =
    storeId == null
      ? null
      : (assignments.find((a) => a.storeId === storeId)?.role ?? null);
  const canManage = isAdmin || hasEncargadaRole;
  const isVendedoraHere = !canManage && directRole === 'vendedora';
  return { isAdmin, hasEncargadaRole, directRole, canManage, isVendedoraHere };
}
