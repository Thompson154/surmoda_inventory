import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { AdminHomePage } from '../AdminHomePage';
import { server } from '@/test/server';
import { ToastProvider } from '@/shared/ui';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

const BASE = 'http://localhost:3000/api/v1';

afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ user: null, accessToken: null });
});

describe('AdminHomePage — Autorizaciones pendientes', () => {
  it('renders "Ver autorizaciones pendientes" card with pending badge linking to /admin/return-requests', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'admin-1',
        email: 'admin@surmoda.test',
        fullName: 'Admin User',
        isAdmin: true,
        assignments: [],
      },
    });
    server.use(
      http.get(`${BASE}/return-requests`, () =>
        HttpResponse.json({ items: [], total: 3, page: 1, pageSize: 1 }),
      ),
      http.get(`${BASE}/alerts`, () => HttpResponse.json({ items: [] })),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter>
            <AdminHomePage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    const link = screen.getByRole('link', { name: /ver autorizaciones pendientes/i });
    expect(link).toHaveAttribute('href', '/admin/return-requests');

    await waitFor(() => {
      expect(screen.getByText(/3 pendientes/i)).toBeInTheDocument();
    });
  });
});
