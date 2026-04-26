import type {
  DailyReportDTO as DailyReportDTOContract,
  ListDailyReportsFilters,
  PaginatedDailyReports as PaginatedDailyReportsContract,
} from '@surmoda/contracts';

export type DailyReportDTO = DailyReportDTOContract;
export type PaginatedDailyReports = PaginatedDailyReportsContract;
export type ListDailyReportsFiltersDTO = ListDailyReportsFilters;

export interface ListDailyReportsQuery {
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
