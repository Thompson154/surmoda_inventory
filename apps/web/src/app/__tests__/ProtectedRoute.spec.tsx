import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthUser } from '@surmoda/contracts';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

function setUser(user: AuthUser | null) {
  useAuthStore.setState({ user });
}

const adminUser: AuthUser = {
  id: 'a1',
  email: 'admin@test.com',
  fullName: 'Admin',
  isAdmin: true,
  assignments: [],
};
const vendedoraUser: AuthUser = {
  id: 'v1',
  email: 'v@test.com',
  fullName: 'Vendedora',
  isAdmin: false,
  assignments: [{ storeId: 's1', role: 'vendedora' }],
};
const encargadaUser: AuthUser = {
  id: 'e1',
  email: 'e@test.com',
  fullName: 'Encargada',
  isAdmin: false,
  assignments: [{ storeId: 's1', role: 'encargada' }],
};

function renderRoute(initialPath: string, action?: string, fallback?: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/sales/register" element={<div>sales register</div>} />
        <Route path="/sedes" element={<div>sedes</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute action={action as never} fallback={fallback}>
              <div>protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => setUser(null));

  it('redirects to /login when no user', () => {
    renderRoute('/protected');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders children for admin with any action', () => {
    setUser(adminUser);
    renderRoute('/protected', 'users:manage');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('renders children when user has required action (vendedora sales:create)', () => {
    setUser(vendedoraUser);
    renderRoute('/protected', 'sales:create');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects vendedora to /sedes when action not permitted (SedePicker re-decides landing)', () => {
    setUser(vendedoraUser);
    renderRoute('/protected', 'users:manage');
    // WHY: post-fix, fallback unificado a /sedes para evitar redirect loop;
    // SedePickerPage decide si mandarla a scanner o inventario según rol.
    expect(screen.getByText('sedes')).toBeInTheDocument();
  });

  it('redirects encargada to /sedes when action not permitted', () => {
    setUser(encargadaUser);
    renderRoute('/protected', 'users:manage');
    expect(screen.getByText('sedes')).toBeInTheDocument();
  });

  it('renders children when no action required and user is authenticated', () => {
    setUser(vendedoraUser);
    renderRoute('/protected');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('uses custom fallback when provided', () => {
    setUser(encargadaUser);
    renderRoute('/protected', 'users:manage', '/login');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
