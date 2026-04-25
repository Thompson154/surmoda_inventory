// WHY: thin re-export — feature 002 replaced the local seed shim with a real
// query against /api/v1/stores. Kept for backwards-compat in this feature only;
// new code should import from `@/features/stores/hooks/useStores` directly.
export { useStores, useStoreLabel } from '@/features/stores/hooks/useStores';
