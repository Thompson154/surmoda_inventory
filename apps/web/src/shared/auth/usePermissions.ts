import { can, type Action, type Role } from './permissions';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

interface Permissions {
  role: Role | null;
  is: (r: Role) => boolean;
  can: (action: Action) => boolean;
}

// WHY: derives role from auth store — admin flag takes precedence over assignments
export function usePermissions(): Permissions {
  const user = useAuthStore((s) => s.user);

  const role: Role | null = (() => {
    if (!user) return null;
    if (user.isAdmin) return 'admin';
    const firstAssignment = user.assignments[0];
    if (!firstAssignment) return null;
    return firstAssignment.role as Role;
  })();

  return {
    role,
    is: (r: Role) => role === r,
    can: (action: Action) => (role ? can(role, action) : false),
  };
}
