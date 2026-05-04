import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { returnRequestsQueryKeys, returnRequestsService } from '../services/returnRequestsService';
import type {
  CreateReturnRequestPayload,
  ListReturnRequestsFilters,
  RejectReturnRequestPayload,
} from '../types';

export function useMyReturnRequests(filters: ListReturnRequestsFilters) {
  return useQuery({
    queryKey: returnRequestsQueryKeys.mine(filters),
    queryFn: () => returnRequestsService.listMine(filters),
  });
}

export function useAdminReturnRequests(filters: ListReturnRequestsFilters) {
  return useQuery({
    queryKey: returnRequestsQueryKeys.admin(filters),
    queryFn: () => returnRequestsService.listAdmin(filters),
  });
}

export function useReturnRequestDetail(id: string) {
  return useQuery({
    queryKey: returnRequestsQueryKeys.detail(id),
    queryFn: () => returnRequestsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateReturnRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReturnRequestPayload) => returnRequestsService.create(payload),
    onSuccess: () => {
      // WHY: invalidate both mine and admin lists so all views reflect the new request
      void qc.invalidateQueries({ queryKey: returnRequestsQueryKeys.all });
    },
  });
}

export function useApproveReturnRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => returnRequestsService.approve(id),
    onSuccess: () => {
      // WHY: approval changes stock and request status — refresh everything
      void qc.invalidateQueries({ queryKey: returnRequestsQueryKeys.all });
    },
  });
}

export function useRejectReturnRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: RejectReturnRequestPayload) =>
      returnRequestsService.reject(id, rejectionReason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: returnRequestsQueryKeys.all });
    },
  });
}

export function useClosuresWithSales(storeId: string, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: returnRequestsQueryKeys.closures(storeId, fromDate, toDate),
    queryFn: () => returnRequestsService.getClosuresWithSales(storeId, fromDate, toDate),
    // WHY: only fetch when we have a store and a valid date range
    enabled: Boolean(storeId) && Boolean(fromDate) && Boolean(toDate),
  });
}
