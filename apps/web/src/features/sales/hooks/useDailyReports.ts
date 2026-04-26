import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CloseDayPayload, ListDailyReportsFilters } from '@surmoda/contracts';
import {
  dailyReportsQueryKeys,
  dailyReportsService,
} from '../services/dailyReportsService';
import { salesQueryKeys } from '../services/salesService';

export function useDailyReports(
  storeId: string | undefined,
  filters: ListDailyReportsFilters = {},
) {
  return useQuery({
    queryKey: storeId
      ? dailyReportsQueryKeys.list(storeId, filters)
      : ['dailyReports', 'list', 'noop'],
    queryFn: () => dailyReportsService.list(storeId as string, filters),
    enabled: Boolean(storeId),
    placeholderData: (prev) => prev,
  });
}

export function useDailyReportByDate(
  storeId: string | undefined,
  isoDay: string | undefined,
) {
  return useQuery({
    queryKey: storeId && isoDay
      ? dailyReportsQueryKeys.detail(storeId, isoDay)
      : ['dailyReports', 'detail', 'noop'],
    queryFn: () => dailyReportsService.getByDate(storeId as string, isoDay as string),
    enabled: Boolean(storeId && isoDay),
    retry: false,
  });
}

export function useDailyReportItems(
  storeId: string | undefined,
  isoDay: string | undefined,
) {
  return useQuery({
    queryKey: storeId && isoDay
      ? dailyReportsQueryKeys.items(storeId, isoDay)
      : ['dailyReports', 'items', 'noop'],
    queryFn: () => dailyReportsService.getItemsByDate(storeId as string, isoDay as string),
    enabled: Boolean(storeId && isoDay),
  });
}

export function useCloseToday(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CloseDayPayload) => dailyReportsService.closeToday(storeId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dailyReportsQueryKeys.all });
      void qc.invalidateQueries({ queryKey: salesQueryKeys.dashboard(storeId) });
    },
  });
}

export function useStoreStaff(storeId: string | undefined) {
  return useQuery({
    queryKey: storeId ? dailyReportsQueryKeys.staff(storeId) : ['dailyReports', 'staff', 'noop'],
    queryFn: () => dailyReportsService.listStaff(storeId as string),
    enabled: Boolean(storeId),
    staleTime: 60_000,
  });
}
