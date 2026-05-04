import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import {
  useMyReturnRequests,
  useAdminReturnRequests,
  useCreateReturnRequest,
  useApproveReturnRequest,
  useRejectReturnRequest,
} from '../useReturnRequests';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

const mockRequest = {
  id: 'rr-1',
  storeId: 'store-prado-seed',
  storeName: 'Prado',
  requestedById: 'user-1',
  requestedByFullName: 'Ana García',
  returnedVariantBarcode: 'BARCODE-123',
  quantity: 1,
  saleDate: '2026-04-25',
  reason: 'Talla incorrecta',
  status: 'pending' as const,
  createdAt: '2026-04-28T10:00:00.000Z',
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe('useMyReturnRequests', () => {
  it('fetches /return-requests/mine and returns items', async () => {
    server.use(
      http.get(`${BASE}/return-requests/mine`, () =>
        HttpResponse.json({ items: [mockRequest], total: 1, page: 1, pageSize: 20 }),
      ),
    );

    const { result } = renderHook(() => useMyReturnRequests({}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });
});

describe('useAdminReturnRequests', () => {
  it('fetches /return-requests (admin list) and returns items', async () => {
    server.use(
      http.get(`${BASE}/return-requests`, () =>
        HttpResponse.json({ items: [mockRequest], total: 1, page: 1, pageSize: 20 }),
      ),
    );

    const { result } = renderHook(() => useAdminReturnRequests({}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });
});

describe('useCreateReturnRequest', () => {
  it('posts and invalidates return-requests queries on success', async () => {
    server.use(
      http.post(`${BASE}/return-requests`, () => HttpResponse.json(mockRequest, { status: 201 })),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateReturnRequest(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    result.current.mutate({
      storeId: 'store-prado-seed',
      returnedVariantBarcode: 'BARCODE-123',
      quantity: 1,
      saleDate: '2026-04-25',
      reason: 'Talla incorrecta',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useApproveReturnRequest', () => {
  it('calls approve and invalidates return-requests queries on success', async () => {
    server.use(
      http.post(`${BASE}/return-requests/rr-1/approve`, () =>
        HttpResponse.json({ ...mockRequest, status: 'approved' }),
      ),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useApproveReturnRequest(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    result.current.mutate('rr-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useRejectReturnRequest', () => {
  it('calls reject with reason and invalidates return-requests queries on success', async () => {
    server.use(
      http.post(`${BASE}/return-requests/rr-1/reject`, () =>
        HttpResponse.json({ ...mockRequest, status: 'rejected', rejectionReason: 'No aplica' }),
      ),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRejectReturnRequest(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    result.current.mutate({ id: 'rr-1', rejectionReason: 'No aplica' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
