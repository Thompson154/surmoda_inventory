import { useQuery } from '@tanstack/react-query';
import { alertsQueryKeys, alertsService } from '../services/alertsService';

const POLL_MS = 60_000;

/**
 * Polls /alerts every minute. The endpoint is cheap (cached by RBAC scope on
 * BE) and read-only — keeping it on a fixed interval gives the bell a
 * near-realtime feel without adding push infra.
 *
 * Returns 403 for vendedoras → we swallow and return empty so the bell just
 * stays silent for them instead of spamming the error UI.
 */
export function useAlerts(enabled: boolean) {
  return useQuery({
    queryKey: alertsQueryKeys.list(),
    queryFn: () => alertsService.list(),
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
    // Empty fallback for the forbidden case keeps the rest of the UI calm.
    placeholderData: { items: [], countsByKind: { STOCK_LOW: 0, STOCK_OUT_HOT: 0, CIERRE_MISSING: 0 } },
  });
}
