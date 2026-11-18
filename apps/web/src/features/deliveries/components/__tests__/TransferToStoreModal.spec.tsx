import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { TransferToStoreModal } from '../TransferToStoreModal';
import { server } from '@/test/server';
import { makeQueryClient } from '@/test/utils';
import { ToastProvider } from '@/shared/ui';

const BASE = 'http://localhost:3000/api/v1';
const ORIGIN_ID = 'store-prado-seed';

function makeRows(start: number, count: number) {
  return Array.from({ length: count }, (_, idx) => {
    const n = start + idx;
    return {
      variantId: `var-${n}`,
      productId: `prod-${n}`,
      productCode: `PRENDA-${n}`,
      productName: `Prenda ${n}`,
      size: 'm',
      color: 'negro',
      barcode: `BARCODE000${n}`,
      priceCents: 10000,
      imagePath: null,
      quantity: 5,
    };
  });
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe('TransferToStoreModal — paginated inventory loading', () => {
  it('loads 10 items initially and appends page 2 when scrolling/loading more', async () => {
    const requestedPages: Array<{ page: string | null; pageSize: string | null }> = [];
    server.use(
      http.get(`${BASE}/stores/transfer-destinations`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'store-online',
              code: 'ONLINE',
              name: 'Ventas Online',
              kind: 'branch',
              isActive: true,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          total: 1,
        }),
      ),
      http.get(`${BASE}/stores/${ORIGIN_ID}/inventory`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page');
        const pageSize = url.searchParams.get('pageSize');
        requestedPages.push({ page, pageSize });
        const pageNum = Number(page ?? '1');
        return HttpResponse.json({
          items: pageNum === 1 ? makeRows(1, 10) : makeRows(11, 5),
          total: 15,
          page: pageNum,
          pageSize: 10,
        });
      }),
    );

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <ToastProvider>
          <TransferToStoreModal fromStoreId={ORIGIN_ID} open={true} onClose={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('PRENDA-1')).toBeInTheDocument();
    });
    expect(screen.getByText('Mostrando 10 de 15')).toBeInTheDocument();
    expect(screen.queryByText('PRENDA-11')).not.toBeInTheDocument();
    expect(requestedPages[0]).toEqual({ page: '1', pageSize: '10' });

    fireEvent.click(screen.getByRole('button', { name: /cargar más/i }));

    await waitFor(() => {
      expect(screen.getByText('PRENDA-11')).toBeInTheDocument();
    });
    expect(screen.getByText('Mostrando 15 de 15')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cargar más/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('PRENDA-1').closest('button')!);
    expect(screen.getByText(/A enviar \(1 unidad\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('transfer-inventory-picker').className).toContain('shrink-0');
  });
});
