// Tests for <ReportPreviewModal> (TAREA 7 — component tests).

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { SalesReportPreview } from '../../types';
import { ReportPreviewModal } from '../ReportPreviewModal';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

const BASE = 'http://localhost:3000/api/v1';

const mockPreview: SalesReportPreview = {
  store: { id: 'store-prado-seed', name: 'Sucursal Prado', code: 'PRADO' },
  period: { from: '2026-01-01', to: '2026-01-31' },
  sales: {
    rows: [
      {
        saleDate: '2026-01-10',
        saleTime: '14:00:00',
        ticketNumber: 'TKT-001',
        productCode: 'JN001',
        variantDescription: 'Jean Bota Recta',
        color: 'azul',
        size: '30',
        quantity: 2,
        unitPriceCents: 10000,
        subtotalCents: 20000,
        paymentMethod: 'cash',
        cashier: 'Lucía Vendedora',
      },
    ],
    totalRows: 1,
    totalAmountCents: 20000,
  },
  paymentSummary: { cash: 20000, card: 0, qr: 0, total: 20000 },
  generatedAt: '2026-01-31T00:00:00.000Z',
};

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(<ReportPreviewModal isOpen onClose={onClose} preview={mockPreview} />);
}

describe('ReportPreviewModal', () => {
  it('renders the report header with store name and period', () => {
    renderModal();
    expect(screen.getAllByText(/Sucursal Prado/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-31/)).toBeInTheDocument();
  });

  it('renders total amount formatted in Bs', () => {
    renderModal();
    // 20000 cents = Bs. 200 — formatBs returns "Bs. 200"
    const elements = screen.getAllByText((text) => text.includes('200') && text.includes('Bs'));
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders the sales table with correct columns', () => {
    renderModal();
    expect(screen.getByText('Fecha')).toBeInTheDocument();
    expect(screen.getByText('Ticket')).toBeInTheDocument();
    expect(screen.getByText('Producto')).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
  });

  it('renders payment summary mini-cards when paymentSummary is present', () => {
    renderModal();
    expect(screen.getByText(/Efectivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Tarjeta/i)).toBeInTheDocument();
    expect(screen.getByText(/QR/i)).toBeInTheDocument();
  });

  it('renders Descargar Excel completo button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Descargar Excel completo/i })).toBeInTheDocument();
  });

  it('calls onClose when footer Cerrar button is clicked', () => {
    const onClose = vi.fn();
    renderModal(onClose);
    // Multiple "Cerrar" roles: X icon button (aria-label) + footer button text
    // Footer button is the last one in tab order
    const cerrarBtns = screen.getAllByRole('button', { name: /Cerrar/i });
    fireEvent.click(cerrarBtns[cerrarBtns.length - 1]!);
    expect(onClose).toHaveBeenCalled();
  });

  it('triggers download mutation when Descargar Excel is clicked', async () => {
    let xlsxRequested = false;
    server.use(
      http.post(`${BASE}/reports/sales`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        if (body.format === 'xlsx') xlsxRequested = true;
        return new HttpResponse(new Blob([new Uint8Array([80, 75])]), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="reporte.xlsx"',
          },
        });
      }),
    );

    // Render FIRST, then mock so React's DOM setup is not affected
    renderModal();

    // Setup URL and anchor mocks AFTER render
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn().mockReturnValue('blob:fake'),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
    const fakeAnchor = { href: '', download: '', click: vi.fn() };
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return fakeAnchor as unknown as HTMLElement;
      return originalCreate(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    fireEvent.click(screen.getByRole('button', { name: /Descargar Excel completo/i }));

    await waitFor(() => {
      expect(xlsxRequested).toBe(true);
    });

    vi.restoreAllMocks();
  });
});
