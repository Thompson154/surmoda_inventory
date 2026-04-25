import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/authService';
import { useAuthStore, type AuthUser } from '../stores/useAuthStore';

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
    enabled: Boolean(accessToken),
    retry: 0,
  });
}
