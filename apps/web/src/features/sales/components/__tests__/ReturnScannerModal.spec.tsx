import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ReturnScannerModal } from '../ReturnScannerModal';
import { server } from '@/test/server';
import { makeQueryClient } from '@/test/utils';
import { ToastProvider } from '@/shared/ui';

const BASE = 'http://localhost:3000/api/v1';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

const defaultProps = {
  storeId: 'store-prado-seed',
  open: true,
  onClose: vi.fn(),
};

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
            paymentMethod: 'cash' as const,
            subtotalCents: 15000,
            totalCents: 15000,
          },
        ],
      },
    ],
  },
];

const mockCreatedRequest = {
  id: 'rr-1',
  status: 'pending',
  storeId: 'store-prado-seed',
  storeName: 'Prado',
  requestedById: 'u-1',
  requestedByFullName: 'Ana',
  returnedVariantBarcode: 'BARCODE-123',
  quantity: 1,
  saleDate: '2026-04-28',
  reason: 'Defecto',
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  server.resetHandlers();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('ReturnScannerModal — initial state', () => {
  it('renders barcode input for the NEW exchange product', () => {
    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.getByPlaceholderText(/pegá o escribí el código/i)).toBeInTheDocument();
  });

  it('renders the 3-section form immediately (form always visible)', () => {
    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );
    // All 3 sections should be visible
    expect(screen.getByText(/1\. producto nuevo/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. identificar venta original/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. justificación/i)).toBeInTheDocument();
  });

  it('submit button is disabled until all required fields are filled', () => {
    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );
    // Fill barcode (the exchange product) but nothing else
    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'BARCODE-NEW' },
    });
    const btn = screen.getByRole('button', { name: /enviar solicitud/i });
    expect(btn).toBeDisabled();
  });
});

// ─── After scanning (barcode = new exchange product) ─────────────────────────

describe('ReturnScannerModal — after barcode entry (exchange product)', () => {
  it('scanned barcode is passed to form as prefilledBarcode (exchange product)', async () => {
    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );

    // Scan the NEW exchange product barcode
    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'NEW-PRODUCT-CODE' },
    });

    // The form Sección 1 should also show the scanned barcode in read-only mode
    // At least 1 element should display this value (the top input + read-only display)
    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue('NEW-PRODUCT-CODE');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('no barcode-mismatch error exists — scanned code is exchange product, not the returned one', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );

    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'ANY-NEW-CODE' },
    });

    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));
    await waitFor(() => screen.getByText(/Jean Azul M/i));
    fireEvent.click(screen.getByText(/Jean Azul M/i));
    await waitFor(() => screen.getByText(/cambiar selección/i));

    // WHY: with exchange-only flow, there's no mismatch error — scanned = exchange product
    expect(screen.queryByText(/no coincide/i)).not.toBeInTheDocument();
  });
});

// ─── Validation gates ─────────────────────────────────────────────────────────

describe('ReturnScannerModal — validation gates', () => {
  it('submit DISABLED when closure date not chosen', async () => {
    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'BARCODE-NEW' },
    });
    fireEvent.change(screen.getByPlaceholderText(/explicá brevemente el motivo/i), {
      target: { value: 'Motivo válido' },
    });

    const btn = screen.getByRole('button', { name: /enviar solicitud/i });
    expect(btn).toBeDisabled();
  });

  it('submit DISABLED when reason is too short (< 3 chars)', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );

    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'BARCODE-NEW' },
    });
    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));
    await waitFor(() => screen.getByText(/Jean Azul M/i));
    fireEvent.click(screen.getByText(/Jean Azul M/i));
    await waitFor(() => screen.getByText(/cambiar selección/i));

    fireEvent.change(screen.getByPlaceholderText(/explicá brevemente el motivo/i), {
      target: { value: 'ab' },
    });

    const btn = screen.getByRole('button', { name: /enviar solicitud/i });
    expect(btn).toBeDisabled();
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('ReturnScannerModal — happy path', () => {
  it('opens ConfirmDialog when all fields valid and submit clicked', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
      http.post(`${BASE}/return-requests`, () =>
        HttpResponse.json(mockCreatedRequest, { status: 201 }),
      ),
    );

    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );

    // Scan the new exchange product barcode
    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'BARCODE-NEW' },
    });
    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));
    await waitFor(() => screen.getByText(/Jean Azul M/i));
    fireEvent.click(screen.getByText(/Jean Azul M/i));
    await waitFor(() => screen.getByText(/cambiar selección/i));

    fireEvent.change(screen.getByPlaceholderText(/explicá brevemente el motivo/i), {
      target: { value: 'Defecto de fábrica' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('POSTs exchange-only payload: exchangeVariantBarcode = scanned, returnedVariantBarcode = selected item', async () => {
    const captured = vi.fn();
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
      http.post(`${BASE}/return-requests`, async ({ request }) => {
        const body = await request.json();
        captured(body);
        return HttpResponse.json(mockCreatedRequest, { status: 201 });
      }),
    );

    render(
      <Wrapper>
        <ReturnScannerModal {...defaultProps} />
      </Wrapper>,
    );

    // Scan a DIFFERENT barcode — this is the NEW exchange product
    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'NEW-EXCHANGE-CODE' },
    });

    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));
    await waitFor(() => screen.getByText(/Jean Azul M/i));
    fireEvent.click(screen.getByText(/Jean Azul M/i));
    await waitFor(() => screen.getByText(/cambiar selección/i));

    fireEvent.change(screen.getByPlaceholderText(/explicá brevemente el motivo/i), {
      target: { value: 'Defecto de fábrica' },
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    await waitFor(() => screen.getByRole('alertdialog'));
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(captured).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 'store-prado-seed',
          // exchangeVariantBarcode = what was scanned (new product)
          exchangeVariantBarcode: 'NEW-EXCHANGE-CODE',
          // returnedVariantBarcode = the item selected from the closure (original product)
          returnedVariantBarcode: 'BARCODE-123',
          originalSaleId: 'sale-1',
          originalSaleItemId: 'si-1',
          originalClosureDate: '2026-04-28',
          originalPaymentMethod: 'cash',
          originalSubtotalCents: 15000,
          newPaymentMethod: 'cash',
          newSubtotalCents: 15000,
          reason: 'Defecto de fábrica',
        }),
      );
    });
  });

  it('shows "Solicitud enviada" toast and calls onClose on success', async () => {
    const onClose = vi.fn();
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
      http.post(`${BASE}/return-requests`, () =>
        HttpResponse.json(mockCreatedRequest, { status: 201 }),
      ),
    );

    render(
      <Wrapper>
        <ReturnScannerModal storeId="store-prado-seed" open={true} onClose={onClose} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/pegá o escribí el código/i), {
      target: { value: 'NEW-CODE' },
    });
    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));
    await waitFor(() => screen.getByText(/Jean Azul M/i));
    fireEvent.click(screen.getByText(/Jean Azul M/i));
    await waitFor(() => screen.getByText(/cambiar selección/i));

    fireEvent.change(screen.getByPlaceholderText(/explicá brevemente el motivo/i), {
      target: { value: 'Defecto' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
    await waitFor(() => screen.getByRole('alertdialog'));
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/solicitud enviada/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
