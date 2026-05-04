import { useQuery } from '@tanstack/react-query';
import { alertsQueryKeys, alertsService } from '../services/alertsService';

const POLL_MS = 60_000;

/**
 * Polls /alerts every minute. The endpoint is cheap (cached by RBAC scope on
 * BE) and read-only — keeping it on a fixed interval gives the bell a
 * near-realtime feel without adding push infra.
 *
 * When `storeId` is provided, only alerts for that branch are fetched
 * (e.g. when the user is inside /sedes/:storeId/*). When absent, all alerts
 * are fetched (e.g. /sedes picker or /admin).
 *
 * Returns 403 for vendedoras → we swallow and return empty so the bell just
 * stays silent for them instead of spamming the error UI.
 */
export function useAlerts(enabled: boolean, storeId?: string) {
  return useQuery({
    queryKey: alertsQueryKeys.list(storeId),
    queryFn: () => alertsService.list(storeId),
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
    // Empty fallback for the forbidden case keeps the rest of the UI calm.
    placeholderData: {
      items: [],
      countsByKind: { STOCK_LOW: 0, STOCK_OUT_HOT: 0, CIERRE_MISSING: 0 },
    },
  });
}
