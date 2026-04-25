import { type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useCurrentRole } from '../hooks/useCurrentRole';

type AllowedRole = 'admin' | 'encargada' | 'vendedora';

interface Props {
  allow: AllowedRole[];
  children: ReactNode;
}

export function RoleGuardedRoute({ allow, children }: Props) {
  const user = useAuthStore((s) => s.user);
  const params = useParams<{ storeId?: string }>();
  const role = useCurrentRole(params.storeId ?? null);

  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/" replace />;
  if (!allow.includes(role as AllowedRole)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
