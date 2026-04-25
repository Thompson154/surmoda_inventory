import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useStoreLabel, useStores } from '../useStores';
import { makeQueryClient } from '@/test/utils';

function makeWrapper() {
  const client = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useStores', () => {
  it('fetches the active stores list and returns the expected shape', async () => {
    const { result } = renderHook(() => useStores(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const items = result.current.data?.items ?? [];
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.find((s) => s.id === 'store-prado-seed')?.name).toBe('Sucursal Prado');
  });
});

describe('useStoreLabel', () => {
  it('resolves a store id to its name once the cache is warm', async () => {
    const { result } = renderHook(() => useStoreLabel('store-prado-seed'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current).toBe('Sucursal Prado'));
  });

  it('falls back to the storeId when the store is not in the list', async () => {
    const { result } = renderHook(() => useStoreLabel('store-unknown'), {
      wrapper: makeWrapper(),
    });

    // First render = id fallback (cache cold). After fetch resolves, cache is warm but
    // the unknown id still has no match → label stays as the id.
    await waitFor(() => expect(result.current).toBe('store-unknown'));
  });
});
