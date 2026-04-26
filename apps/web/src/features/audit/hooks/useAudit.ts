import { useQuery } from '@tanstack/react-query';
import type { AuditLogFilters } from '@surmoda/contracts';
import { auditQueryKeys, auditService } from '../services/auditService';

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: auditQueryKeys.list(filters),
    queryFn: () => auditService.list(filters),
    placeholderData: (prev) => prev,
  });
}
