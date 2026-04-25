// T098 — UserForm component tests (R4 MSW)
// WHY: ensure user creation form renders all fields, toggles admin,
//      submits correct payload, and surfaces API errors.

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserForm } from '../index';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserForm', () => {
  it('renders email, password, fullName fields and the submit button', () => {
    renderWithProviders(<UserForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña inicial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear usuario/i })).toBeInTheDocument();
  });

  it('shows assignments section by default (staff mode)', () => {
    renderWithProviders(<UserForm />);
    expect(screen.getByText(/asignaciones de tienda/i)).toBeInTheDocument();
  });

  it('hides assignments section when admin toggle is enabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserForm />);

    const adminCheckbox = screen.getByRole('checkbox', { name: /es admin global/i });
    await user.click(adminCheckbox);

    await waitFor(() => {
      expect(screen.queryByText(/asignaciones de tienda/i)).not.toBeInTheDocument();
    });
  });

  it('submitting as staff navigates to user detail page on success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserForm />);

    await user.type(screen.getByLabelText(/email/i), 'staff@test.local');
    await user.type(screen.getByLabelText(/nombre completo/i), 'Staff Member');
    await user.type(screen.getByLabelText(/contraseña inicial/i), 'password123');
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/users/user-1', { replace: true });
    });
  });

  it('submitting as admin sends request without assignments', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('http://localhost:3000/api/v1/users', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            id: 'user-admin-1',
            email: 'admin@test.local',
            fullName: 'Admin User',
            isAdmin: true,
            isActive: true,
            assignments: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm />);

    const adminCheckbox = screen.getByRole('checkbox', { name: /es admin global/i });
    await user.click(adminCheckbox);

    await user.type(screen.getByLabelText(/email/i), 'admin@test.local');
    await user.type(screen.getByLabelText(/nombre completo/i), 'Admin User');
    await user.type(screen.getByLabelText(/contraseña inicial/i), 'password123');
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => {
      expect((capturedBody as Record<string, unknown>).isAdmin).toBe(true);
      expect((capturedBody as Record<string, unknown>).assignments).toBeUndefined();
    });
  });

  it('shows "Ya existe un usuario con ese email." on 409 USER_CREATE_DUPLICATE_EMAIL', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/users', () =>
        HttpResponse.json(
          { code: 'USER_CREATE_DUPLICATE_EMAIL', message: 'Duplicate email' },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm />);

    await user.type(screen.getByLabelText(/email/i), 'dup@test.local');
    await user.type(screen.getByLabelText(/nombre completo/i), 'Dup User');
    await user.type(screen.getByLabelText(/contraseña inicial/i), 'password123');
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    await screen.findByText('Ya existe un usuario con ese email.');
  });
});
