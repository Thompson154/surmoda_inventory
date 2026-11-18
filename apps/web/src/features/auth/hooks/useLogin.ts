import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';
import type { LoginCredentials } from '../types';
import { canSwitchStores, landingPathFor, resolveUserRole } from '@/shared/auth/usePermissions';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (creds: LoginCredentials) => authService.login(creds),
    onSuccess: (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user });
      const uniqueStores = Array.from(new Set(data.user.assignments.map((a) => a.storeId)));
      if (!canSwitchStores(data.user) && uniqueStores.length === 1) {
        navigate(landingPathFor(resolveUserRole(data.user), uniqueStores[0]!), { replace: true });
        return;
      }
      navigate('/', { replace: true });
    },
  });
}
