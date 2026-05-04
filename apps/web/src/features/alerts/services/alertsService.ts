import type { AlertsResponse } from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';

export const alertsService = {
  list: (storeId?: string) => {
    const url = storeId ? `/alerts?storeId=${encodeURIComponent(storeId)}` : '/alerts';
    return httpClient.get<AlertsResponse>(url);
  },
};

export const alertsQueryKeys = {
  all: ['alerts'] as const,
  // storeId is part of the key so per-branch queries never share cache.
  list: (storeId?: string) => ['alerts', 'list', storeId ?? 'all'] as const,
};
