import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { useProduct, useProducts } from '../useProducts';
import { makeQueryClient } from '@/test/utils';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

function makeWrapper() {
  const client = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useProducts', () => {
  it('fetches the catalog list and returns the expected shape', async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
    expect(result.current.data?.items[0]?.code).toBe('JN001');
  });

  it('does NOT send q param when query is an empty string', async () => {
    const capturedUrl = vi.fn<(url: string) => void>();
    server.use(
      http.get(`${BASE}/products`, ({ request }) => {
        capturedUrl(request.url);
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        });
      }),
    );

    const { result } = renderHook(() => useProducts({ q: '' }), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toHaveBeenCalledOnce();
    const url = new URL(capturedUrl.mock.calls[0]![0]);
    expect(url.searchParams.has('q')).toBe(false);
  });

  it('does NOT send q param when query is whitespace only', async () => {
    const capturedUrl = vi.fn<(url: string) => void>();
    server.use(
      http.get(`${BASE}/products`, ({ request }) => {
        capturedUrl(request.url);
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        });
      }),
    );

    const { result } = renderHook(() => useProducts({ q: '   ' }), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toHaveBeenCalledOnce();
    const url = new URL(capturedUrl.mock.calls[0]![0]);
    expect(url.searchParams.has('q')).toBe(false);
  });

  it('sends q param when query has meaningful content', async () => {
    const capturedUrl = vi.fn<(url: string) => void>();
    server.use(
      http.get(`${BASE}/products`, ({ request }) => {
        capturedUrl(request.url);
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        });
      }),
    );

    const { result } = renderHook(() => useProducts({ q: 'jean' }), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toHaveBeenCalledOnce();
    const url = new URL(capturedUrl.mock.calls[0]![0]);
    expect(url.searchParams.get('q')).toBe('jean');
  });
});

describe('useProduct', () => {
  it('fetches a product by id with embedded variants', async () => {
    const { result } = renderHook(() => useProduct('prod-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.code).toBe('JN001');
    expect(result.current.data?.variants.length).toBe(1);
    expect(result.current.data?.variants[0]?.size).toBe('30');
  });

  it('does not fire the query when the id is undefined', async () => {
    const { result } = renderHook(() => useProduct(undefined), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
