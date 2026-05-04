import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { saleReturnService } from '../saleReturnService';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

describe('saleReturnService.create', () => {
  afterEach(() => server.resetHandlers());

  it('posts to /sales/returns with the given payload', async () => {
    const captured = vi.fn<(body: unknown) => void>();

    server.use(
      http.post(`${BASE}/sales/returns`, async ({ request }) => {
        const body = await request.json();
        captured(body);
        return HttpResponse.json({ id: 'mv-return-1' }, { status: 201 });
      }),
    );

    const payload = {
      storeId: 'store-prado-seed',
      barcode: 'ABC123ABC123',
      paymentMethod: 'cash' as const,
      reason: 'talla incorrecta',
    };

    await saleReturnService.create(payload);

    expect(captured).toHaveBeenCalledOnce();
    expect(captured).toHaveBeenCalledWith(payload);
  });

  it('returns the response body from the server', async () => {
    const fakeResponse = { id: 'mv-return-2', type: 'sale_return' };

    server.use(
      http.post(`${BASE}/sales/returns`, () => HttpResponse.json(fakeResponse, { status: 201 })),
    );

    const result = await saleReturnService.create({
      storeId: 'store-prado-seed',
      barcode: 'XYZ',
      paymentMethod: 'qr' as const,
    });

    expect(result).toEqual(fakeResponse);
  });

  it('throws an HttpError when the server returns an error', async () => {
    server.use(
      http.post(`${BASE}/sales/returns`, () =>
        HttpResponse.json(
          { code: 'SALES_RETURN_CREATE_INVALID_BARCODE', message: 'Barcode not found' },
          { status: 404 },
        ),
      ),
    );

    await expect(
      saleReturnService.create({
        storeId: 'store-prado-seed',
        barcode: 'NOTEXIST',
        paymentMethod: 'cash' as const,
      }),
    ).rejects.toMatchObject({ code: 'SALES_RETURN_CREATE_INVALID_BARCODE' });
  });
});
