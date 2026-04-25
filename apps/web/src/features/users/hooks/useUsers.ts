import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usersService } from '../services/usersService';
import type { CreateUserPayload, ListUsersFilters } from '../types';

export const usersQueryKeys = {
  all: ['users'] as const,
  list: (filters: ListUsersFilters) => ['users', 'list', filters] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

export function useUsers(filters: ListUsersFilters = {}) {
  return useQuery({
    queryKey: usersQueryKeys.list(filters),
    queryFn: () => usersService.list(filters),
    placeholderData: (prev) => prev,
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: id ? usersQueryKeys.detail(id) : ['users', 'detail', 'noop'],
    queryFn: () => usersService.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.create(payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      navigate(`/users/${created.id}`, { replace: true });
    },
  });
}
