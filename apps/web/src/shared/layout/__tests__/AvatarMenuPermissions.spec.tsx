import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuthUser } from '@surmoda/contracts';
import { AvatarMenu } from '../AvatarMenu';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/features/auth/services/authService', () => ({
  authService: { logout: vi.fn().mockResolvedValue(undefined) },
}));

function setUser(user: AuthUser | null) {
  useAuthStore.setState({ user });
}

function renderAndOpen() {
  render(
    <MemoryRouter>
      <AvatarMenu />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));
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
  assignments: [{ storeId: 's1', role: 'vendedora', storeKind: 'branch' }],
};
const branchEncargadaUser: AuthUser = {
  id: 'e1',
  email: 'liz@surmoda.com.bo',
  fullName: 'Liz',
  isAdmin: false,
  assignments: [
    { storeId: 'store-online', role: 'encargada', storeKind: 'branch' },
    { storeId: 'store-online', role: 'vendedora', storeKind: 'branch' },
  ],
};
const warehouseEncargadaUser: AuthUser = {
  id: 'g1',
  email: 'gloria@surmoda.com.bo',
  fullName: 'Gloria',
  isAdmin: false,
  assignments: [{ storeId: 'store-almacen', role: 'encargada', storeKind: 'warehouse' }],
};

describe('AvatarMenu — role-based visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser(null);
  });

  it('shows Panel admin link for admin', () => {
    setUser(adminUser);
    renderAndOpen();
    expect(screen.getByRole('menuitem', { name: /panel admin/i })).toBeInTheDocument();
  });

  it('hides Panel admin link for vendedora', () => {
    setUser(vendedoraUser);
    renderAndOpen();
    expect(screen.queryByRole('menuitem', { name: /panel admin/i })).not.toBeInTheDocument();
  });

  it('shows "Volver a sucursales" for admin', () => {
    setUser(adminUser);
    renderAndOpen();
    expect(screen.getByRole('menuitem', { name: /volver a sucursales/i })).toBeInTheDocument();
  });

  it('shows "Volver a sucursales" for warehouse encargada', () => {
    setUser(warehouseEncargadaUser);
    renderAndOpen();
    expect(screen.getByRole('menuitem', { name: /volver a sucursales/i })).toBeInTheDocument();
  });

  it('hides "Volver a sucursales" for single-branch encargada and vendedora', () => {
    setUser(branchEncargadaUser);
    renderAndOpen();
    expect(
      screen.queryByRole('menuitem', { name: /volver a sucursales/i }),
    ).not.toBeInTheDocument();
  });

  it('hides "Volver a sucursales" for vendedora', () => {
    setUser(vendedoraUser);
    renderAndOpen();
    expect(
      screen.queryByRole('menuitem', { name: /volver a sucursales/i }),
    ).not.toBeInTheDocument();
  });

  it('always shows logout regardless of role', () => {
    setUser(vendedoraUser);
    renderAndOpen();
    expect(screen.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument();
  });
});
