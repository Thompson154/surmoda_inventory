import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/shared/auth/usePermissions';
import type { Action } from '@/shared/auth/permissions';

interface Props {
  action?: Action;
  fallback?: string;
  children: ReactNode;
}

// WHY: centralises role-based redirect logic — no scattered isAdmin checks
export function ProtectedRoute({ action, fallback, children }: Props) {
  const { role, can } = usePermissions();

  if (!role) return <Navigate to="/login" replace />;

  if (action && !can(action)) {
    // WHY: '/sedes' es un destino seguro para todos los roles — SedePickerPage
    // re-decide el landing correcto según rol; '/sales/register' (sin storeId)
    // no existe en el router y rompía con redirect loop.
    return <Navigate to={fallback ?? '/sedes'} replace />;
  }

  return <>{children}</>;
}
