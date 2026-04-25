import { httpClient } from '@/shared/services/httpClient';
import type {
  Assignment,
  AssignmentsListResponse,
  CreateAssignmentPayload,
  UpdateAssignmentPayload,
} from '../types';

export const assignmentsService = {
  list: (userId: string) =>
    httpClient.get<AssignmentsListResponse>(`/users/${userId}/assignments`),
  create: (userId: string, payload: CreateAssignmentPayload) =>
    httpClient.post<Assignment>(`/users/${userId}/assignments`, payload),
  updateRole: (userId: string, assignmentId: string, payload: UpdateAssignmentPayload) =>
    httpClient.patch<Assignment>(`/users/${userId}/assignments/${assignmentId}`, payload),
  remove: (userId: string, assignmentId: string, options: { confirm?: boolean } = {}) => {
    const qs = options.confirm ? '?confirm=true' : '';
    return httpClient.delete<void>(`/users/${userId}/assignments/${assignmentId}${qs}`);
  },
};
