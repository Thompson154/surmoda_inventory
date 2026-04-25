import { useAuthStore, type AuthAssignment } from '@/features/auth/stores/useAuthStore';

export function useCurrentRole(storeId: string | null): AuthAssignment['role'] | 'admin' | null {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  if (user.isAdmin) return 'admin';
  if (!storeId) return null;
  return user.assignments.find((a) => a.storeId === storeId)?.role ?? null;
}
