import { httpClient } from '@/shared/services/httpClient';
import type { AlertsResponse } from '@surmoda/contracts';

export const alertsService = {
  list: () => httpClient.get<AlertsResponse>('/alerts'),
};

export const alertsQueryKeys = {
  all: ['alerts'] as const,
  list: () => ['alerts', 'list'] as const,
};
