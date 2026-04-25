import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useInventory, useStockMovements, useEditPermission } from '../useInventory';
import { makeQueryClient } from '@/test/utils';

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
