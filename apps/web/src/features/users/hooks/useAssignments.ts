import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentsService } from '../services/assignmentsService';
import type { CreateAssignmentPayload, UpdateAssignmentPayload } from '../types';
import { usersQueryKeys } from './useUsers';

const assignmentsQueryKey = (userId: string) => ['assignments', userId] as const;

export function useAssignments(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? assignmentsQueryKey(userId) : ['assignments', 'noop'],
    queryFn: () => assignmentsService.list(userId as string),
    enabled: Boolean(userId),
  });
}

function useInvalidate(userId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: assignmentsQueryKey(userId) });
    void queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(userId) });
    void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
  };
}

export function useAddAssignment(userId: string) {
  const invalidate = useInvalidate(userId);
  return useMutation({
    mutationFn: (payload: CreateAssignmentPayload) => assignmentsService.create(userId, payload),
    onSuccess: invalidate,
  });
}

export function useChangeAssignmentRole(userId: string) {
  const invalidate = useInvalidate(userId);
  return useMutation({
    mutationFn: (input: { assignmentId: string; payload: UpdateAssignmentPayload }) =>
      assignmentsService.updateRole(userId, input.assignmentId, input.payload),
    onSuccess: invalidate,
  });
}

export function useRemoveAssignment(userId: string) {
  const invalidate = useInvalidate(userId);
  return useMutation({
    mutationFn: (input: { assignmentId: string; confirm?: boolean }) =>
      assignmentsService.remove(userId, input.assignmentId, { confirm: input.confirm }),
    onSuccess: invalidate,
  });
}
