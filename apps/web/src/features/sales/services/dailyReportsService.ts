import { httpClient } from '@/shared/services/httpClient';
import type {
  CloseDayPayload,
  DailyReportDTO,
  DailyReportItemsDTO,
  ListDailyReportsFilters,
  PaginatedDailyReports,
  StoreStaffMember,
} from '@surmoda/contracts';

function buildQS(filters: ListDailyReportsFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const dailyReportsService = {
  list: (storeId: string, filters: ListDailyReportsFilters = {}) =>
    httpClient.get<PaginatedDailyReports>(`/stores/${storeId}/daily-reports${buildQS(filters)}`),
  getByDate: (storeId: string, isoDay: string) =>
    httpClient.get<DailyReportDTO>(`/stores/${storeId}/daily-reports/${isoDay}`),
  getItemsByDate: (storeId: string, isoDay: string) =>
    httpClient.get<DailyReportItemsDTO>(`/stores/${storeId}/daily-reports/${isoDay}/items`),
  closeToday: (storeId: string, payload: CloseDayPayload = { attendedUserIds: [] }) =>
    httpClient.post<DailyReportDTO>(
      `/stores/${storeId}/daily-reports/close-today`,
      payload,
    ),
  listStaff: (storeId: string) =>
    httpClient.get<{ items: StoreStaffMember[] }>(
      `/stores/${storeId}/daily-reports/staff`,
    ),
};

export const dailyReportsQueryKeys = {
  all: ['dailyReports'] as const,
  list: (storeId: string, filters: ListDailyReportsFilters) =>
    ['dailyReports', 'list', storeId, filters] as const,
  detail: (storeId: string, isoDay: string) =>
    ['dailyReports', 'detail', storeId, isoDay] as const,
  items: (storeId: string, isoDay: string) =>
    ['dailyReports', 'items', storeId, isoDay] as const,
  staff: (storeId: string) => ['dailyReports', 'staff', storeId] as const,
};
