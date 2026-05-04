import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { AdminReturnRequestsPage } from '../AdminReturnRequestsPage';
import { server } from '@/test/server';
import { ToastProvider } from '@/shared/ui';

const BASE = 'http://localhost:3000/api/v1';

const approvedRequest = {
  id: 'rr-approved-1',
  storeId: 'store-prado-seed',
  storeName: 'Prado',
  requestedById: 'user-1',
  requestedByFullName: 'Ana García',
  returnedVariantBarcode: 'BARCODE-123',
  quantity: 1,
  saleDate: '2026-04-25',
  reason: 'Talla incorrecta',
  status: 'approved' as const,
  reviewedAt: '2026-04-29T12:00:00.000Z',
  createdAt: '2026-04-28T10:00:00.000Z',
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe('AdminReturnRequestsPage — Autorizadas recientemente tab', () => {
  beforeEach(() => {
    server.use(
      http.get(`${BASE}/return-requests`, ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        if (status === 'approved') {
          return HttpResponse.json({
            items: [approvedRequest],
            total: 1,
            page: 1,
            pageSize: 50,
          });
        }
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
      }),
    );
  });

  it('has an "Autorizadas recientemente" tab', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AdminReturnRequestsPage />
      </Wrapper>,
    );
    expect(screen.getByRole('tab', { name: /autorizadas recientemente/i })).toBeInTheDocument();
  });

  it('shows approved requests when "Autorizadas recientemente" tab is clicked', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AdminReturnRequestsPage />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /autorizadas recientemente/i }));

    await waitFor(() => {
      expect(screen.getByText(/Ana García/i)).toBeInTheDocument();
    });
  });

  it('fetches with status=approved and pageSize=50 for that tab', async () => {
    const captured = vi.fn();
    server.use(
      http.get(`${BASE}/return-requests`, ({ request }) => {
        const url = new URL(request.url);
        captured({
          status: url.searchParams.get('status'),
          pageSize: url.searchParams.get('pageSize'),
        });
        return HttpResponse.json({ items: [approvedRequest], total: 1, page: 1, pageSize: 50 });
      }),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AdminReturnRequestsPage />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /autorizadas recientemente/i }));

    await waitFor(() => {
      expect(captured).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', pageSize: '50' }),
      );
    });
  });
});
