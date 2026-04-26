import type { AuditLogFilters, AuditLogListResponse } from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';

function buildQuery(filters: AuditLogFilters): string {
  const qs = new URLSearchParams();
  if (filters.userId) qs.set('userId', filters.userId);
  if (filters.storeId) qs.set('storeId', filters.storeId);
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.pageSize) qs.set('pageSize', String(filters.pageSize));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const auditService = {
  list: (filters: AuditLogFilters) =>
    httpClient.get<AuditLogListResponse>(`/audit-logs${buildQuery(filters)}`),
};

export const auditQueryKeys = {
  all: ['audit'] as const,
  list: (filters: AuditLogFilters) =>
    [
      'audit',
      'list',
      filters.userId ?? null,
      filters.storeId ?? null,
      filters.page ?? 1,
      filters.pageSize ?? 50,
    ] as const,
};
