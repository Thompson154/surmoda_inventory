// T096 — LogoutButton component tests (Strict TDD)
// WHY: clicking the button must call authService.logout, clear the auth store,
//      and redirect to /login.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LogoutButton } from '../LogoutButton';
import { useAuthStore } from '../../stores/useAuthStore';
import * as authServiceModule from '../../services/authService';

// Spy on authService.logout
const logoutSpy = vi.spyOn(authServiceModule.authService, 'logout');

// react-router navigate spy
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Pre-populate the auth store as if the user is logged in
  useAuthStore.setState({
    accessToken: 'fake-access-token',
    user: {
      id: 'u1',
      email: 'test@test.local',
      fullName: 'Test User',
      isAdmin: false,
      assignments: [],
    },
  });
});

describe('LogoutButton', () => {
  it('renders a logout button with Spanish text', () => {
    renderWithProviders(<LogoutButton />);
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('calls authService.logout when clicked', async () => {
    logoutSpy.mockResolvedValue(undefined);
    renderWithProviders(<LogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('clears the auth store after logout', async () => {
    logoutSpy.mockResolvedValue(undefined);
    renderWithProviders(<LogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  it('redirects to /login after logout', async () => {
    logoutSpy.mockResolvedValue(undefined);
    renderWithProviders(<LogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('still clears auth store even if logout API call fails', async () => {
    logoutSpy.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<LogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.user).toBeNull();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });
});
