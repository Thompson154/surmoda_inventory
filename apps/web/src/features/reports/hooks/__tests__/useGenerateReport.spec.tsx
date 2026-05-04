// Tests for useGenerateReportPreview and useDownloadXlsx (TAREA 7 — hook tests).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeQueryClient } from '@/test/utils';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

const mockPreview = {
  store: { id: 'store-prado-seed', name: 'Sucursal Prado', code: 'PRADO' },
  period: { from: '2026-01-01', to: '2026-01-31' },
  sales: { rows: [], totalRows: 5, totalAmountCents: 50000 },
  generatedAt: '2026-01-31T00:00:00.000Z',
};

function makeWrapper() {
  const client = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

describe('useGenerateReportPreview', () => {
  it('does NOT fetch when args is null (query is disabled)', async () => {
    let called = false;
    server.use(
      http.post(`${BASE}/reports/sales`, () => {
        called = true;
        return HttpResponse.json(mockPreview);
      }),
    );

    const { useGenerateReportPreview } = await import('../useGenerateReport');
    const { result } = renderHook(() => useGenerateReportPreview(null), {
      wrapper: makeWrapper(),
    });

    // With enabled:false, the query stays in 'pending' but fetchStatus='idle'
    // (no network call). We check that no request was triggered.
    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(false);
    // fetchStatus should be idle, not 'fetching'
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('fetches when args is provided and returns preview data', async () => {
    server.use(http.post(`${BASE}/reports/sales`, () => HttpResponse.json(mockPreview)));

    const { useGenerateReportPreview } = await import('../useGenerateReport');
    const { result } = renderHook(
      () =>
        useGenerateReportPreview({
          storeId: 'store-prado-seed',
          from: '2026-01-01',
          to: '2026-01-31',
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.store.code).toBe('PRADO');
    expect(result.current.data?.sales.totalRows).toBe(5);
  });
});

describe('useDownloadXlsx', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers browser download on mutation success', async () => {
    const fakeBlob = new Blob([new Uint8Array([80, 75])], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    server.use(
      http.post(
        `${BASE}/reports/sales`,
        () =>
          new HttpResponse(fakeBlob, {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': 'attachment; filename="reporte-ventas-PRADO.xlsx"',
            },
          }),
      ),
    );

    // URL.createObjectURL/revokeObjectURL don't exist in jsdom — define them
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURLSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURLSpy,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURLSpy,
      writable: true,
      configurable: true,
    });

    const mockAnchor = { href: '', download: '', click: vi.fn() };
    // Only mock createElement for 'a' tags; pass through everything else so React renders fine
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLElement;
      return originalCreateElement(tag);
    });
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const { useDownloadXlsx } = await import('../useGenerateReport');
    const { result } = renderHook(() => useDownloadXlsx(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({
        storeId: 'store-prado-seed',
        from: '2026-01-01',
        to: '2026-01-31',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(mockAnchor.href).toBe('blob:fake');
    expect(mockAnchor.download).toBe('reporte-ventas-PRADO.xlsx');
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:fake');
  });
});
