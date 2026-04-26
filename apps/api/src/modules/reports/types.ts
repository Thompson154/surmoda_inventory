import type { ReportRangeFilter, ReportSummaryDTO } from '@surmoda/contracts';

export type ReportSummary = ReportSummaryDTO;
export type ReportRange = ReportRangeFilter;

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
