// Tests for salesReportService (TAREA 7 — service tests).
// Uses MSW to intercept fetch calls via the global test server.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

describe('salesReportService.getPreview', () => {
  it('sends POST to /reports/sales with format=preview and returns data', async () => {
    const mockPreview = {
      store: { id: 'store-1', name: 'Sucursal Prado', code: 'PRADO' },
      period: { from: '2026-01-01', to: '2026-01-31' },
      sales: { rows: [], totalRows: 0, totalAmountCents: 0 },
      generatedAt: '2026-01-31T00:00:00.000Z',
    };

    let capturedBody: unknown = null;
    server.use(
      http.post(`${BASE}/reports/sales`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockPreview);
      }),
    );

    const { salesReportService } = await import('../salesReportService');
    const result = await salesReportService.getPreview({
      storeId: 'store-prado-seed',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect((capturedBody as Record<string, unknown>).format).toBe('preview');
    expect((capturedBody as Record<string, unknown>).storeId).toBe('store-prado-seed');
    expect(result.store.code).toBe('PRADO');
    expect(result.sales.totalRows).toBe(0);
  });
});

describe('salesReportService.downloadXlsx', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST to /reports/sales with format=xlsx and extracts filename from Content-Disposition', async () => {
    const fakeXlsx = new Uint8Array([80, 75, 3, 4]);
    const fakeBlob = new Blob([fakeXlsx], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    let capturedFormat: unknown = null;
    server.use(
      http.post(`${BASE}/reports/sales`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        capturedFormat = body.format;
        return new HttpResponse(fakeBlob, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="reporte-ventas-PRADO-2026-01.xlsx"',
          },
        });
      }),
    );

    const { salesReportService } = await import('../salesReportService');
    const { blob, filename } = await salesReportService.downloadXlsx({
      storeId: 'store-prado-seed',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(capturedFormat).toBe('xlsx');
    // Blob-like: has a size property and is truthy
    expect(blob).toBeTruthy();
    expect(typeof blob.size).toBe('number');
    expect(filename).toBe('reporte-ventas-PRADO-2026-01.xlsx');
  });

  it('falls back to default filename when Content-Disposition is missing', async () => {
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
            },
          }),
      ),
    );

    const { salesReportService } = await import('../salesReportService');
    const { filename } = await salesReportService.downloadXlsx({
      storeId: 'store-prado-seed',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(filename).toBe('reporte-ventas.xlsx');
  });
});
