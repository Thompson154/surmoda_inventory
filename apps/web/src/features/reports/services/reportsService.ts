import type { ReportRangeFilter, ReportSummaryDTO } from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';

export const reportsService = {
  summary: (range: ReportRangeFilter) =>
    httpClient.get<ReportSummaryDTO>(
      `/reports/summary?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    ),
};

export const reportsQueryKeys = {
  all: ['reports'] as const,
  summary: (range: ReportRangeFilter) => ['reports', 'summary', range.from, range.to] as const,
};
