export type Role = 'encargada' | 'vendedora';

export interface UserAssignment {
  id: string;
  storeId: string;
  role: Role;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  assignments: UserAssignment[];
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

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  isAdmin: boolean;
  assignments?: Array<{ storeId: string; role: Role }>;
}

export interface ListUsersFilters {
  q?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  page?: number;
  pageSize?: number;
}
