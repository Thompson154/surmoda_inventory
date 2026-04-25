import type { Role } from '@prisma/client';

export interface UserAssignmentDTO {
  id: string;
  storeId: string;
  role: Role;
}

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  assignments: UserAssignmentDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  assignmentsCount: number;
  createdAt: string;
}

export interface PaginatedUsers {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  fullName: string;
  isAdmin: boolean;
  assignments?: Array<{ storeId: string; role: Role }>;
}

export interface ListUsersQuery {
  q?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  page: number;
  pageSize: number;
}

export interface UpdateUserDTO {
  fullName?: string;
  isAdmin?: boolean;
}
