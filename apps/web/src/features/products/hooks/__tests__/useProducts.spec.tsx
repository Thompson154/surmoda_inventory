import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProduct, useProducts } from '../useProducts';
import { makeQueryClient } from '@/test/utils';

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
