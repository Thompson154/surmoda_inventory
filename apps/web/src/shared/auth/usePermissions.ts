import type { AuthUser } from '@surmoda/contracts';
import { can, type Action, type Role } from './permissions';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

interface Permissions {
  role: Role | null;
  is: (r: Role) => boolean;
  can: (action: Action) => boolean;
}

/** Resolve primary role for a user; encargada takes precedence over vendedora. */
export function resolveUserRole(user: AuthUser | null | undefined): Role | null {
  if (!user) return null;
  if (user.isAdmin) return 'admin';
  if (user.assignments.some((a) => a.role === 'encargada')) return 'encargada';
  if (user.assignments.some((a) => a.role === 'vendedora')) return 'vendedora';
  return null;
}

/** True only for admin or warehouse encargada (or users assigned to multiple stores). */
export function canSwitchStores(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (user.assignments.some((a) => a.role === 'encargada' && a.storeKind === 'warehouse')) {
    return true;
  }
  return new Set(user.assignments.map((a) => a.storeId)).size > 1;
}

/** Landing path inside a store based on role. */
export function landingPathFor(role: Role | string | null, storeId: string): string {
  if (role === 'vendedora') return `/sedes/${storeId}/scanner`;
  return `/sedes/${storeId}/inventario`;
}

// WHY: derives role from auth store — admin flag takes precedence over assignments
export function usePermissions(): Permissions {
  const user = useAuthStore((s) => s.user);
  const role = resolveUserRole(user);

  return {
    role,
    is: (r: Role) => role === r,
    can: (action: Action) => (role ? can(role, action) : false),
  };
}
