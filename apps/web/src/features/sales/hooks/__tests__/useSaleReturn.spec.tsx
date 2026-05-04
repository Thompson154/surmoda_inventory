import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { useSaleReturn } from '../useSaleReturn';
import { server } from '@/test/server';
import { makeQueryClient } from '@/test/utils';

const BASE = 'http://localhost:3000/api/v1';

function makeWrapper() {
  const client = makeQueryClient();
  return {
    client,
    Wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    },
  };
}

describe('useSaleReturn', () => {
  afterEach(() => server.resetHandlers());

  it('invalidates inventory and movements queries on success', async () => {
    server.use(
      http.post(`${BASE}/sales/returns`, () =>
        HttpResponse.json({ id: 'mv-1', type: 'sale_return' }, { status: 201 }),
      ),
    );

    const { client, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSaleReturn(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        storeId: 'store-prado-seed',
        barcode: 'ABC123ABC123',
        paymentMethod: 'cash',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Must invalidate both inventory and movements query families
    const keys = invalidateSpy.mock.calls.map((c) => {
      const opts = c[0] as { queryKey?: unknown[] };
      return opts?.queryKey?.[0];
    });
    expect(keys).toContain('inventory');
    expect(keys).toContain('sales');
  });

  it('exposes the mapped Spanish error message on failure', async () => {
    server.use(
      http.post(`${BASE}/sales/returns`, () =>
        HttpResponse.json(
          { code: 'SALES_RETURN_CREATE_INVALID_BARCODE', message: 'not found' },
          { status: 404 },
        ),
      ),
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaleReturn(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          storeId: 'store-prado-seed',
          barcode: 'NOTEXIST',
          paymentMethod: 'cash',
        });
      } catch {
        // expected rejection
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.spanishError).toBe('No encontramos un producto con ese código.');
  });
});
