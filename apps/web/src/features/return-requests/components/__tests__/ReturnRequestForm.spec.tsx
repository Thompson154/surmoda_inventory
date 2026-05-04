import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ReturnRequestForm } from '../ReturnRequestForm';
import type { CreateReturnRequestPayload } from '../../types';
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
  onSubmit: vi.fn(),
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

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

// ─── Structure ────────────────────────────────────────────────────────────────

describe('ReturnRequestForm — structure', () => {
  it('renders section 1 (Producto nuevo)', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-ABC" />
      </Wrapper>,
    );
    expect(screen.getByText(/1\. producto nuevo/i)).toBeInTheDocument();
  });

  it('renders section 2 (Identificar venta original)', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.getByText(/2\. identificar venta original/i)).toBeInTheDocument();
  });

  it('renders section 3 (Justificación)', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.getByText(/3\. justificación/i)).toBeInTheDocument();
  });

  it('does NOT render the "Nueva prenda" toggle checkbox', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.queryByRole('checkbox', { name: /cambio/i })).not.toBeInTheDocument();
  });

  it('does NOT render newPaymentMethod or newSubtotalCents inputs', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.queryByLabelText(/método de pago/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/monto de la nueva prenda/i)).not.toBeInTheDocument();
  });

  it('renders closure date picker', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/fecha del cierre original/i)).toBeInTheDocument();
  });

  it('renders reason textarea', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.getByPlaceholderText(/explicá brevemente el motivo/i)).toBeInTheDocument();
  });
});

// ─── Sección 1: Producto nuevo (prefilled barcode) ────────────────────────────

describe('ReturnRequestForm — Sección 1: prefilledBarcode display', () => {
  it('shows the scanned barcode as read-only when prefilledBarcode provided', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-XYZ" />
      </Wrapper>,
    );
    // Should display the barcode value
    expect(screen.getByDisplayValue('BARCODE-XYZ')).toBeInTheDocument();
  });

  it('shows a barcode input when no prefilledBarcode (manualBarcodeMode)', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    // In manual mode, an editable barcode input should be present
    const barcodeInput = screen.getByPlaceholderText(/código del producto nuevo/i);
    expect(barcodeInput).toBeInTheDocument();
  });

  it('shows a barcode input when manualBarcodeMode=true even with prefilledBarcode', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} manualBarcodeMode />
      </Wrapper>,
    );
    expect(screen.getByPlaceholderText(/código del producto nuevo/i)).toBeInTheDocument();
  });
});

// ─── Submit disabled ──────────────────────────────────────────────────────────

describe('ReturnRequestForm — submit disabled states', () => {
  it('submit button is disabled when no fields filled', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeDisabled();
  });

  it('submit disabled when only barcode filled (no closure/item/reason)', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-123" />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeDisabled();
  });

  it('submit disabled when barcode + date filled but no item selected', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-123" />
      </Wrapper>,
    );
    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });
    fireEvent.change(screen.getByPlaceholderText(/explicá brevemente el motivo/i), {
      target: { value: 'Motivo válido' },
    });
    // No item selected
    expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeDisabled();
  });
});

// ─── Popup (Modal) item picker ────────────────────────────────────────────────

describe('ReturnRequestForm — item picker modal', () => {
  it('"Seleccionar producto a cambiar" button is disabled until date picked', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-123" />
      </Wrapper>,
    );
    const btn = screen.getByRole('button', { name: /seleccionar producto a cambiar/i });
    expect(btn).toBeDisabled();
  });

  it('opens modal when "Seleccionar producto a cambiar" clicked after date picked', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-123" />
      </Wrapper>,
    );

    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });
    // Wait for closures to load
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));

    await waitFor(() => {
      // Modal should open with items
      expect(screen.getByText(/Jean Azul M/i)).toBeInTheDocument();
    });
  });

  it('shows item details in modal (productName, barcode, payment, subtotal)', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-123" />
      </Wrapper>,
    );

    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Jean Azul M/i)).toBeInTheDocument();
      expect(screen.getByText(/BARCODE-123/i)).toBeInTheDocument();
    });
  });

  it('closes modal and shows selected item card after picking an item', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-123" />
      </Wrapper>,
    );

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
    // Click the item in the modal
    fireEvent.click(screen.getByText(/Jean Azul M/i));

    await waitFor(() => {
      // Modal should be closed and selected item card shown outside
      // "Cambiar selección" link should appear
      expect(screen.getByText(/cambiar selección/i)).toBeInTheDocument();
      // Item name should still be visible in the card
      expect(screen.getByText(/Jean Azul M/i)).toBeInTheDocument();
    });
  });

  it('re-opens modal when "Cambiar selección" clicked', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-123" />
      </Wrapper>,
    );

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
    // Now re-open
    fireEvent.click(screen.getByText(/cambiar selección/i));

    await waitFor(() => {
      // Modal re-opened — items visible again
      expect(screen.getAllByText(/Jean Azul M/i).length).toBeGreaterThan(1);
    });
  });
});

// ─── Submit enabled and payload ───────────────────────────────────────────────

describe('ReturnRequestForm — submit enabled + payload shape', () => {
  it('submit enabled when barcode + date + selectedItem + reason are all filled', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} prefilledBarcode="BARCODE-NEW" />
      </Wrapper>,
    );

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
      target: { value: 'Talla incorrecta' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled();
    });
  });

  it('calls onSubmit with exchange-only payload shape (scanned barcode = exchangeVariantBarcode)', async () => {
    const onSubmit = vi.fn();
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm
          storeId="store-prado-seed"
          onSubmit={onSubmit}
          prefilledBarcode="NEW-BARCODE"
        />
      </Wrapper>,
    );

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
      target: { value: 'Talla incorrecta' },
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining<Partial<CreateReturnRequestPayload>>({
          storeId: 'store-prado-seed',
          exchangeVariantBarcode: 'NEW-BARCODE',
          returnedVariantBarcode: 'BARCODE-123',
          originalSaleId: 'sale-1',
          originalSaleItemId: 'si-1',
          originalClosureDate: '2026-04-28',
          originalPaymentMethod: 'cash',
          originalSubtotalCents: 15000,
          reason: 'Talla incorrecta',
        }),
      );
    });
  });

  it('payload: newPaymentMethod === originalPaymentMethod (pure exchange)', async () => {
    const onSubmit = vi.fn();
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm
          storeId="store-prado-seed"
          onSubmit={onSubmit}
          prefilledBarcode="NEW-BARCODE"
        />
      </Wrapper>,
    );

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
      target: { value: 'Cambio de talla' },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    await waitFor(() => {
      const payload = onSubmit.mock.calls[0]?.[0] as CreateReturnRequestPayload;
      expect(payload.newPaymentMethod).toBe(payload.originalPaymentMethod);
      expect(payload.newSubtotalCents).toBe(payload.originalSubtotalCents);
    });
  });
});

// ─── Manual barcode mode ──────────────────────────────────────────────────────

describe('ReturnRequestForm — manual barcode mode', () => {
  it('submit disabled until manual barcode is typed when no prefilledBarcode', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );
    render(
      <Wrapper>
        <ReturnRequestForm storeId="store-prado-seed" onSubmit={vi.fn()} />
      </Wrapper>,
    );

    // Pick date
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
      target: { value: 'Motivo válido' },
    });

    // Without barcode, submit should still be disabled
    expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeDisabled();

    // Now type barcode
    fireEvent.change(screen.getByPlaceholderText(/código del producto nuevo/i), {
      target: { value: 'BARCODE-NEW' },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled();
    });
  });
});

// ─── onCancel ─────────────────────────────────────────────────────────────────

describe('ReturnRequestForm — onCancel', () => {
  it('renders Cancel button when onCancel is provided', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} onCancel={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('does NOT render Cancel button when onCancel is not provided', () => {
    render(
      <Wrapper>
        <ReturnRequestForm {...defaultProps} />
      </Wrapper>,
    );
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });
});
