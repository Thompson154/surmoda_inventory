import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { useInventory, useStockMovements, useEditPermission } from '../useInventory';
import { makeQueryClient } from '@/test/utils';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

function makeWrapper() {
  const client = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useInventory', () => {
  it('fetches the inventory grid for a store', async () => {
    const { result } = renderHook(() => useInventory('store-prado-seed'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
    expect(result.current.data?.items[0]?.barcode).toBe('ABC123ABC123');
  });

  it('does not fire when storeId is undefined', () => {
    const { result } = renderHook(() => useInventory(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useStockMovements', () => {
  it('fetches the movements list', async () => {
    const { result } = renderHook(() => useStockMovements('store-prado-seed', 1), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
    expect(result.current.data?.items[0]?.userFullName).toBe('Admin Demo');
  });
});

describe('useEditPermission', () => {
  it('returns the current toggle state', async () => {
    const { result } = renderHook(() => useEditPermission('store-prado-seed'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isEnabled).toBe(false);
  });
});

describe('useInventory — q guard', () => {
  it('does NOT send q param when query is whitespace only', async () => {
    const capturedUrl = vi.fn<(url: string) => void>();
    server.use(
      http.get(`${BASE}/stores/:storeId/inventory`, ({ request }) => {
        capturedUrl(request.url);
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
      }),
    );

    const { result } = renderHook(() => useInventory('store-prado-seed', { q: '  ' }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toHaveBeenCalledOnce();
    const url = new URL(capturedUrl.mock.calls[0]![0]);
    expect(url.searchParams.has('q')).toBe(false);
  });

  it('sends q param when query has meaningful content', async () => {
    const capturedUrl = vi.fn<(url: string) => void>();
    server.use(
      http.get(`${BASE}/stores/:storeId/inventory`, ({ request }) => {
        capturedUrl(request.url);
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
      }),
    );

    const { result } = renderHook(() => useInventory('store-prado-seed', { q: 'jean' }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toHaveBeenCalledOnce();
    const url = new URL(capturedUrl.mock.calls[0]![0]);
    expect(url.searchParams.get('q')).toBe('jean');
  });
});
