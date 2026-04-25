import { httpClient } from '@/shared/services/httpClient';
import type {
  CreateUserPayload,
  ListUsersFilters,
  PaginatedUsers,
  User,
} from '../types';

function buildQueryString(filters: ListUsersFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters.isAdmin !== undefined) params.set('isAdmin', String(filters.isAdmin));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const usersService = {
  list: (filters: ListUsersFilters = {}) =>
    httpClient.get<PaginatedUsers>(`/users${buildQueryString(filters)}`),
  create: (payload: CreateUserPayload) => httpClient.post<User>('/users', payload),
  getById: (id: string) => httpClient.get<User>(`/users/${id}`),
};
