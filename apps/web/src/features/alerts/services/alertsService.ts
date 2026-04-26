import type { AlertsResponse } from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';

export const alertsService = {
  list: () => httpClient.get<AlertsResponse>('/alerts'),
};

export const alertsQueryKeys = {
  all: ['alerts'] as const,
  list: () => ['alerts', 'list'] as const,
};
