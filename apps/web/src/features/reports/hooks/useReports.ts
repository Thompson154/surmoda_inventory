import { useQuery } from '@tanstack/react-query';
import type { ReportRangeFilter } from '@surmoda/contracts';
import { reportsQueryKeys, reportsService } from '../services/reportsService';

export function useReportSummary(range: ReportRangeFilter | null) {
  return useQuery({
    queryKey: range ? reportsQueryKeys.summary(range) : ['reports', 'summary', 'noop'],
    queryFn: () => reportsService.summary(range as ReportRangeFilter),
    enabled: Boolean(range),
    placeholderData: (prev) => prev,
  });
}
