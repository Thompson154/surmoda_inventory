import type { Role } from '@prisma/client';

export interface AssignmentDTO {
  id: string;
  userId: string;
  storeId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentDTO {
  storeId: string;
  role: Role;
}

export interface UpdateAssignmentDTO {
  role: Role;
}

export interface RemoveAssignmentOptions {
  confirm?: boolean;
}
