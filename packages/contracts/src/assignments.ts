import type { Role } from './roles';

export interface Assignment {
  id: string;
  userId: string;
  storeId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentsListResponse {
  items: Assignment[];
}

export interface CreateAssignmentPayload {
  storeId: string;
  role: Role;
}

export interface UpdateAssignmentPayload {
  role: Role;
}
