import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { CreateReturnRequestPage } from '../CreateReturnRequestPage';
import { server } from '@/test/server';
import { ToastProvider } from '@/shared/ui';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

beforeAll(() => {
  useAuthStore.setState({
    accessToken: 'test-token',
    user: {
      id: 'user-1',
      email: 'vendedora@surmoda.test',
      fullName: 'Ana García',
      isAdmin: false,
      assignments: [{ storeId: 'store-prado-seed', role: 'vendedora' }],
    },
  });
});

const BASE = 'http://localhost:3000/api/v1';

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
  id: 'rr-new',
  storeId: 'store-prado-seed',
  storeName: 'Prado',
  requestedById: 'user-1',
  requestedByFullName: 'Ana García',
  returnedVariantBarcode: 'BARCODE-123',
  saleDate: '2026-04-28',
  reason: 'Talla incorrecta',
  status: 'pending' as const,
  createdAt: '2026-04-29T10:00:00.000Z',
};

function makeWrapper(initialEntries: string[] = ['/return-requests/new']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

// ─── Sección 1: manual barcode input ─────────────────────────────────────────

describe('CreateReturnRequestPage — Sección 1: manual barcode entry', () => {
  it('renders a manual barcode input for the new exchange product', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    // Page has no scanner → manual barcode mode active in the form
    expect(screen.getByPlaceholderText(/código del producto nuevo/i)).toBeInTheDocument();
  });

  it('does NOT render a "Nueva prenda" toggle', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    expect(screen.queryByRole('checkbox', { name: /cambio/i })).not.toBeInTheDocument();
  });
});

// ─── Sección 2: closure picker ────────────────────────────────────────────────

describe('CreateReturnRequestPage — Sección 2: closure date picker', () => {
  it('renders a date input for choosing the closure date', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/fecha del cierre original/i)).toBeInTheDocument();
  });

  it('fetches closures-with-sales when a date is selected', async () => {
    const fetchCalled = vi.fn();
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, ({ request }) => {
        fetchCalled(new URL(request.url).searchParams.toString());
        return HttpResponse.json(mockClosures);
      }),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );

    const dateInput = screen.getByLabelText(/fecha del cierre original/i);
    fireEvent.change(dateInput, { target: { value: '2026-04-28' } });

    await waitFor(() => {
      expect(fetchCalled).toHaveBeenCalled();
    });
  });

  it('"Seleccionar producto a cambiar" button appears and can open the modal', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CreateReturnRequestPage />
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
    });
  });

  it('shows selected item card after picking an item from the modal', async () => {
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CreateReturnRequestPage />
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

    // Select the item
    fireEvent.click(screen.getByText(/Jean Azul M/i));

    await waitFor(() => {
      expect(screen.getByText(/cambiar selección/i)).toBeInTheDocument();
    });
  });
});

// ─── Sección 3: reason ────────────────────────────────────────────────────────

describe('CreateReturnRequestPage — Sección 3: reason', () => {
  it('shows reason textarea', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    expect(screen.getByPlaceholderText(/explicá brevemente el motivo/i)).toBeInTheDocument();
  });
});

// ─── Submit ───────────────────────────────────────────────────────────────────

describe('CreateReturnRequestPage — submit with exchange-only payload', () => {
  it('POSTs exchange-only payload: manual barcode = exchangeVariantBarcode, selected item = returnedVariantBarcode', async () => {
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

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <Routes>
          <Route path="/return-requests/new" element={<CreateReturnRequestPage />} />
          <Route path="/return-requests/mine" element={<div>Mine</div>} />
        </Routes>
      </Wrapper>,
    );

    // Step 0: type the new exchange product barcode manually
    fireEvent.change(screen.getByPlaceholderText(/código del producto nuevo/i), {
      target: { value: 'EXCHANGE-BARCODE' },
    });

    // Step 1: select a closure date
    fireEvent.change(screen.getByLabelText(/fecha del cierre original/i), {
      target: { value: '2026-04-28' },
    });

    // Step 2: open modal and select sale item
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /seleccionar producto a cambiar/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar producto a cambiar/i }));
    await waitFor(() => screen.getByText(/Jean Azul M/i));
    fireEvent.click(screen.getByText(/Jean Azul M/i));
    await waitFor(() => screen.getByText(/cambiar selección/i));

    // Step 3: fill reason
    fireEvent.change(screen.getByPlaceholderText(/explicá brevemente el motivo/i), {
      target: { value: 'Talla incorrecta' },
    });

    // Step 4: click submit
    const submitBtn = screen.getByRole('button', { name: /enviar solicitud/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    // Confirm dialog
    await waitFor(() => screen.getByRole('alertdialog'));
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(captured).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeVariantBarcode: 'EXCHANGE-BARCODE',
          returnedVariantBarcode: 'BARCODE-123',
          originalSaleId: 'sale-1',
          originalSaleItemId: 'si-1',
          originalClosureDate: '2026-04-28',
          originalPaymentMethod: 'cash',
          originalSubtotalCents: 15000,
          newPaymentMethod: 'cash',
          newSubtotalCents: 15000,
        }),
      );
    });
  });
});
