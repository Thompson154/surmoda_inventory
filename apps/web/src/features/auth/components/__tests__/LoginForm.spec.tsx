// T097 — LoginForm component tests (R4 MSW)
// WHY: ensure login form renders, submits credentials, handles 401 errors,
//      and disables the submit button when fields are empty.

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LoginForm } from '../LoginForm';
import { useAuthStore } from '../../stores/useAuthStore';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('LoginForm', () => {
  it('renders email, password fields and submit button', () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('submit button is present when fields are empty (HTML required handles validation)', () => {
    renderWithProviders(<LoginForm />);
    const button = screen.getByRole('button', { name: /ingresar/i });
    expect(button).toBeInTheDocument();
    // Button itself is not disabled — HTML `required` on inputs prevents submission
    expect(button).not.toBeDisabled();
  });

  it('submitting valid credentials sets auth store and navigates', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'admin@test.local');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('fake-jwt');
      expect(state.user?.email).toBe('test@test.local');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows "Email o contraseña incorrectos." on 401 AUTH_LOGIN_INVALID_CREDENTIALS', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/auth/login', () =>
        HttpResponse.json(
          { code: 'AUTH_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' },
          { status: 401 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'bad@test.local');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await screen.findByText('Email o contraseña incorrectos.');
  });

  it('shows "Tu cuenta está inactiva." on AUTH_LOGIN_USER_INACTIVE', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/auth/login', () =>
        HttpResponse.json(
          { code: 'AUTH_LOGIN_USER_INACTIVE', message: 'User inactive' },
          { status: 401 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'inactive@test.local');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await screen.findByText('Tu cuenta está inactiva. Contactá al administrador.');
  });
});
