import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AuthUser } from '@surmoda/contracts';
import { usePermissions } from '../usePermissions';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

function setUser(user: AuthUser | null) {
  useAuthStore.setState({ user });
}

const adminUser: AuthUser = {
  id: 'u1',
  email: 'admin@test.com',
  fullName: 'Admin',
  isAdmin: true,
  assignments: [],
};

const vendedoraUser: AuthUser = {
  id: 'u2',
  email: 'v@test.com',
  fullName: 'Vendedora',
  isAdmin: false,
  assignments: [{ storeId: 's1', role: 'vendedora' }],
};

const encargadaUser: AuthUser = {
  id: 'u3',
  email: 'e@test.com',
  fullName: 'Encargada',
  isAdmin: false,
  assignments: [{ storeId: 's1', role: 'encargada' }],
};

describe('usePermissions', () => {
  beforeEach(() => setUser(null));

  describe('no user (unauthenticated)', () => {
    it('returns null role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBeNull();
    });
    it('can() always returns false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('sales:create')).toBe(false);
      expect(result.current.can('admin:everything')).toBe(false);
    });
    it('is() returns false for any role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.is('admin')).toBe(false);
      expect(result.current.is('vendedora')).toBe(false);
    });
  });

  describe('admin user', () => {
    beforeEach(() => setUser(adminUser));

    it('role is admin', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('admin');
    });
    it('is("admin") is true', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.is('admin')).toBe(true);
    });
    it('can do any action', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('users:manage')).toBe(true);
      expect(result.current.can('admin:everything')).toBe(true);
      expect(result.current.can('returns:review')).toBe(true);
    });
  });

  describe('vendedora user', () => {
    beforeEach(() => setUser(vendedoraUser));

    it('role is vendedora', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('vendedora');
    });
    it('can create sales', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('sales:create')).toBe(true);
    });
    it('cannot manage users', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('users:manage')).toBe(false);
    });
    it('is("vendedora") is true, is("admin") is false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.is('vendedora')).toBe(true);
      expect(result.current.is('admin')).toBe(false);
    });
  });

  describe('encargada user', () => {
    beforeEach(() => setUser(encargadaUser));

    it('role is encargada', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('encargada');
    });
    it('can generate reports', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('reports:generate')).toBe(true);
    });
    it('cannot create sales', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('sales:create')).toBe(false);
    });
  });
});
