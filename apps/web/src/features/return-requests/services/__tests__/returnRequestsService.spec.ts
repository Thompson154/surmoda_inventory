import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { returnRequestsService } from '../returnRequestsService';
import { server } from '@/test/server';

// Import after setting up — the module resolves httpClient at import time

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

afterEach(() => {
  server.resetHandlers();
});

describe('returnRequestsService.create', () => {
  it('posts to /return-requests and returns the created request', async () => {
    server.use(
      http.post(`${BASE}/return-requests`, () => HttpResponse.json(mockRequest, { status: 201 })),
    );

    const result = await returnRequestsService.create({
      storeId: 'store-prado-seed',
      returnedVariantBarcode: 'BARCODE-123',
      quantity: 1,
      saleDate: '2026-04-25',
      reason: 'Talla incorrecta',
    });

    expect(result).toMatchObject({ id: 'rr-1', status: 'pending' });
  });

  it('includes exchangeVariantBarcode when provided', async () => {
    const captured = vi.fn();
    server.use(
      http.post(`${BASE}/return-requests`, async ({ request }) => {
        const body = await request.json();
        captured(body);
        return HttpResponse.json(mockRequest, { status: 201 });
      }),
    );

    await returnRequestsService.create({
      storeId: 'store-prado-seed',
      returnedVariantBarcode: 'BARCODE-123',
      exchangeVariantBarcode: 'BARCODE-456',
      quantity: 1,
      saleDate: '2026-04-25',
      reason: 'Cambio de talla',
    });

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({ exchangeVariantBarcode: 'BARCODE-456' }),
    );
  });
});

describe('returnRequestsService.listMine', () => {
  it('gets /return-requests/mine and returns paginated list', async () => {
    server.use(
      http.get(`${BASE}/return-requests/mine`, () =>
        HttpResponse.json({ items: [mockRequest], total: 1, page: 1, pageSize: 20 }),
      ),
    );

    const result = await returnRequestsService.listMine({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe('rr-1');
  });

  it('passes status filter as query param', async () => {
    const captured = vi.fn();
    server.use(
      http.get(`${BASE}/return-requests/mine`, ({ request }) => {
        const url = new URL(request.url);
        captured(url.searchParams.get('status'));
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
      }),
    );

    await returnRequestsService.listMine({ status: 'pending' });
    expect(captured).toHaveBeenCalledWith('pending');
  });
});

describe('returnRequestsService.listAdmin', () => {
  it('gets /return-requests and returns all requests for admin', async () => {
    server.use(
      http.get(`${BASE}/return-requests`, () =>
        HttpResponse.json({ items: [mockRequest], total: 1, page: 1, pageSize: 20 }),
      ),
    );

    const result = await returnRequestsService.listAdmin({});
    expect(result.items).toHaveLength(1);
  });
});

describe('returnRequestsService.getById', () => {
  it('gets /return-requests/:id and returns the request', async () => {
    server.use(http.get(`${BASE}/return-requests/rr-1`, () => HttpResponse.json(mockRequest)));

    const result = await returnRequestsService.getById('rr-1');
    expect(result.id).toBe('rr-1');
  });
});

describe('returnRequestsService.approve', () => {
  it('posts to /return-requests/:id/approve', async () => {
    const captured = vi.fn();
    server.use(
      http.post(`${BASE}/return-requests/rr-1/approve`, () => {
        captured();
        return HttpResponse.json({ ...mockRequest, status: 'approved' });
      }),
    );

    const result = await returnRequestsService.approve('rr-1');
    expect(captured).toHaveBeenCalled();
    expect(result.status).toBe('approved');
  });
});

describe('returnRequestsService.reject', () => {
  it('posts to /return-requests/:id/reject with rejectionReason', async () => {
    const captured = vi.fn();
    server.use(
      http.post(`${BASE}/return-requests/rr-1/reject`, async ({ request }) => {
        const body = await request.json();
        captured(body);
        return HttpResponse.json({
          ...mockRequest,
          status: 'rejected',
          rejectionReason: 'No aplica',
        });
      }),
    );

    const result = await returnRequestsService.reject('rr-1', 'No aplica');
    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({ rejectionReason: 'No aplica' }),
    );
    expect(result.status).toBe('rejected');
  });
});

describe('returnRequestsService.getClosuresWithSales', () => {
  it('gets /return-requests/closures-with-sales with query params', async () => {
    const captured = vi.fn();
    const mockClosures = [
      {
        closureDate: '2026-04-28',
        closureId: 'closure-1',
        sales: [
          {
            saleId: 'sale-1',
            saleItems: [
              {
                id: 'si-1',
                variantBarcode: 'BARCODE-123',
                productName: 'Jean Azul M',
                quantity: 1,
                paymentMethod: 'cash',
                subtotalCents: 15000,
                totalCents: 15000,
              },
            ],
          },
        ],
      },
    ];

    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, ({ request }) => {
        const url = new URL(request.url);
        captured({
          storeId: url.searchParams.get('storeId'),
          fromDate: url.searchParams.get('fromDate'),
          toDate: url.searchParams.get('toDate'),
        });
        return HttpResponse.json(mockClosures);
      }),
    );

    const result = await returnRequestsService.getClosuresWithSales(
      'store-prado-seed',
      '2026-04-28',
      '2026-04-28',
    );

    expect(captured).toHaveBeenCalledWith({
      storeId: 'store-prado-seed',
      fromDate: '2026-04-28',
      toDate: '2026-04-28',
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.closureId).toBe('closure-1');
  });
});
