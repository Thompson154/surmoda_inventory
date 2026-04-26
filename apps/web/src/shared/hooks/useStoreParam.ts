import { useParams } from 'react-router-dom';

/**
 * Resolve `:storeId` from the active route. Returns the string when present
 * or `null` when missing — calling pages then short-circuit (loading state,
 * redirect, error boundary) instead of silently passing an empty string into
 * queries and getting confusing 404s.
 *
 * Default behaviour: caller decides what to render when null. We intentionally
 * do NOT throw here — react-router can land on a route briefly during nav and
 * we don't want to crash the tree.
 */
export function useStoreParam(): string | null {
  const params = useParams<{ storeId: string }>();
  return params.storeId ?? null;
}
