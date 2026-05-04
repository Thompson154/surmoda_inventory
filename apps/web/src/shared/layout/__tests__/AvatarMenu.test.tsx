import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AvatarMenu } from '../AvatarMenu';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useThemeStore } from '@/shared/theme/useTheme';
import * as authServiceModule from '@/features/auth/services/authService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.spyOn(authServiceModule.authService, 'logout').mockResolvedValue(undefined);

function renderMenu() {
  return render(
    <MemoryRouter>
      <AvatarMenu />
    </MemoryRouter>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  useAuthStore.setState({
    accessToken: 'tok',
    user: {
      id: 'u1',
      email: 'a@b.com',
      fullName: 'Test User',
      isAdmin: false,
      assignments: [],
    },
  });
});

describe('AvatarMenu — theme toggle item', () => {
  it('renders theme menu item with "Claro" label when theme is light', () => {
    useThemeStore.getState().setTheme('light');
    renderMenu();
    openMenu();
    expect(screen.getByRole('menuitem', { name: /tema: claro/i })).toBeInTheDocument();
  });

  it('renders theme menu item with "Oscuro" label when theme is dark', () => {
    useThemeStore.getState().setTheme('dark');
    renderMenu();
    openMenu();
    expect(screen.getByRole('menuitem', { name: /tema: oscuro/i })).toBeInTheDocument();
  });

  it('renders theme menu item with "Sistema" label when theme is system', () => {
    useThemeStore.getState().setTheme('system');
    renderMenu();
    openMenu();
    expect(screen.getByRole('menuitem', { name: /tema: sistema/i })).toBeInTheDocument();
  });

  it('clicking theme item calls toggleTheme (theme changes)', () => {
    useThemeStore.getState().setTheme('light');
    renderMenu();
    openMenu();
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: /tema: claro/i }));
    });
    // After toggling from light, theme becomes dark
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('clicking theme item does NOT close the dropdown', () => {
    useThemeStore.getState().setTheme('light');
    renderMenu();
    openMenu();
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: /tema: claro/i }));
    });
    // Menu should still be open — logout button is visible
    expect(screen.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('theme item appears before "Cerrar sesión" in the menu order', () => {
    useThemeStore.getState().setTheme('light');
    renderMenu();
    openMenu();
    const items = screen.getAllByRole('menuitem');
    const themeIdx = items.findIndex((el) => /tema:/i.test(el.textContent ?? ''));
    const logoutIdx = items.findIndex((el) => /cerrar sesión/i.test(el.textContent ?? ''));
    expect(themeIdx).toBeGreaterThanOrEqual(0);
    expect(logoutIdx).toBeGreaterThan(themeIdx);
  });
});
