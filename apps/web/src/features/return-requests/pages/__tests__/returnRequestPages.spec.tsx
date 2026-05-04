import { describe, it, expect, vi, afterEach, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { CreateReturnRequestPage } from '../CreateReturnRequestPage';
import { MyReturnRequestsPage } from '../MyReturnRequestsPage';
import { AdminReturnRequestsPage } from '../AdminReturnRequestsPage';
import { ReviewReturnRequestPage } from '../ReviewReturnRequestPage';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { ToastProvider } from '@/shared/ui';
import { server } from '@/test/server';

beforeAll(() => {
  // WHY: CreateReturnRequestPage reads activeStoreId from auth assignments
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

const mockRequest = {
  id: 'rr-1',
  storeId: 'store-prado-seed',
  storeName: 'Prado',
  requestedById: 'user-1',
  requestedByFullName: 'Ana García',
  returnedVariantBarcode: 'BARCODE-123',
  returnedVariantDescription: 'Remera M Rojo',
  quantity: 1,
  saleDate: '2026-04-25',
  reason: 'Talla incorrecta',
  status: 'pending' as const,
  createdAt: '2026-04-28T10:00:00.000Z',
};

function makeWrapper(initialEntries: string[] = ['/']) {
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

// ---------- CreateReturnRequestPage ----------

describe('CreateReturnRequestPage', () => {
  it('renders the page title', () => {
    const Wrapper = makeWrapper(['/return-requests/new']);
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    expect(screen.getByRole('heading', { name: /nueva solicitud/i })).toBeInTheDocument();
  });

  it('shows closure date picker to identify original sale', () => {
    const Wrapper = makeWrapper(['/return-requests/new']);
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    // WHY: new flow uses closure picker instead of direct barcode entry
    expect(screen.getByLabelText(/fecha del cierre original/i)).toBeInTheDocument();
  });

  it('shows reason textarea with placeholder', () => {
    const Wrapper = makeWrapper(['/return-requests/new']);
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    expect(screen.getByPlaceholderText(/explicá brevemente el motivo/i)).toBeInTheDocument();
  });

  it('disables submit button when reason is too short', () => {
    const Wrapper = makeWrapper(['/return-requests/new']);
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    const submitBtn = screen.getByRole('button', { name: /confirmar solicitud|enviar solicitud/i });
    expect(submitBtn).toBeDisabled();
  });

  it('does NOT show exchange toggle (exchange-only flow, no toggle needed)', () => {
    const Wrapper = makeWrapper(['/return-requests/new']);
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    // WHY: exchange-only spec removes the optional toggle — every request is an exchange
    expect(screen.queryByRole('checkbox', { name: /cambio/i })).not.toBeInTheDocument();
  });

  it('shows manual barcode input for the new exchange product', () => {
    const Wrapper = makeWrapper(['/return-requests/new']);
    render(
      <Wrapper>
        <CreateReturnRequestPage />
      </Wrapper>,
    );
    expect(screen.getByPlaceholderText(/código del producto nuevo/i)).toBeInTheDocument();
  });

  it('submits successfully and shows toast', async () => {
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
    server.use(
      http.get(`${BASE}/return-requests/closures-with-sales`, () =>
        HttpResponse.json(mockClosures),
      ),
      http.post(`${BASE}/return-requests`, () => HttpResponse.json(mockRequest, { status: 201 })),
    );

    const Wrapper = makeWrapper(['/return-requests/new']);
    render(
      <Wrapper>
        <Routes>
          <Route path="/return-requests/new" element={<CreateReturnRequestPage />} />
          <Route path="/return-requests/mine" element={<div>Mine page</div>} />
        </Routes>
      </Wrapper>,
    );

    // Step 0: type the new exchange product barcode
    fireEvent.change(screen.getByPlaceholderText(/código del producto nuevo/i), {
      target: { value: 'EXCHANGE-CODE' },
    });

    // Step 1: select closure date
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
      target: { value: 'La talla no me quedó bien' },
    });

    const submitBtn = screen.getByRole('button', { name: /enviar solicitud/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    // ConfirmDialog should appear
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/solicitud enviada/i)).toBeInTheDocument();
    });
  });
});

// ---------- MyReturnRequestsPage ----------

describe('MyReturnRequestsPage', () => {
  beforeEach(() => {
    server.use(
      http.get(`${BASE}/return-requests/mine`, () =>
        HttpResponse.json({ items: [mockRequest], total: 1, page: 1, pageSize: 20 }),
      ),
    );
  });

  it('renders the page title', async () => {
    const Wrapper = makeWrapper(['/return-requests/mine']);
    render(
      <Wrapper>
        <MyReturnRequestsPage />
      </Wrapper>,
    );
    expect(screen.getByRole('heading', { name: /mis solicitudes/i })).toBeInTheDocument();
  });

  it('shows pending request card once data loads', async () => {
    const Wrapper = makeWrapper(['/return-requests/mine']);
    render(
      <Wrapper>
        <MyReturnRequestsPage />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText(/BARCODE-123/i)).toBeInTheDocument();
    });
  });

  it('shows status filter tabs', () => {
    const Wrapper = makeWrapper(['/return-requests/mine']);
    render(
      <Wrapper>
        <MyReturnRequestsPage />
      </Wrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(tabs.some((t) => /todas/i.test(t.textContent ?? ''))).toBe(true);
  });

  it('shows empty state when no requests exist', async () => {
    server.use(
      http.get(`${BASE}/return-requests/mine`, () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    );

    const Wrapper = makeWrapper(['/return-requests/mine']);
    render(
      <Wrapper>
        <MyReturnRequestsPage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no tenés solicitudes/i)).toBeInTheDocument();
    });
  });
});

// ---------- AdminReturnRequestsPage ----------

describe('AdminReturnRequestsPage', () => {
  beforeEach(() => {
    server.use(
      http.get(`${BASE}/return-requests`, () =>
        HttpResponse.json({ items: [mockRequest], total: 1, page: 1, pageSize: 20 }),
      ),
    );
  });

  it('renders the admin queue title', () => {
    const Wrapper = makeWrapper(['/admin/return-requests']);
    render(
      <Wrapper>
        <AdminReturnRequestsPage />
      </Wrapper>,
    );
    expect(screen.getByRole('heading', { name: /solicitudes de devolución/i })).toBeInTheDocument();
  });

  it('shows requests in the queue', async () => {
    const Wrapper = makeWrapper(['/admin/return-requests']);
    render(
      <Wrapper>
        <AdminReturnRequestsPage />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Ana García/i)).toBeInTheDocument();
    });
  });

  it('has a Revisar link for each request', async () => {
    const Wrapper = makeWrapper(['/admin/return-requests']);
    render(
      <Wrapper>
        <AdminReturnRequestsPage />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /revisar/i })).toBeInTheDocument();
    });
  });
});

// ---------- ReviewReturnRequestPage ----------

describe('ReviewReturnRequestPage', () => {
  beforeEach(() => {
    server.use(http.get(`${BASE}/return-requests/rr-1`, () => HttpResponse.json(mockRequest)));
  });

  it('renders request details after loading', async () => {
    const Wrapper = makeWrapper(['/admin/return-requests/rr-1']);
    render(
      <Wrapper>
        <Routes>
          <Route path="/admin/return-requests/:id" element={<ReviewReturnRequestPage />} />
        </Routes>
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Ana García/i)).toBeInTheDocument();
    });
  });

  it('shows Aprobar and Rechazar buttons', async () => {
    const Wrapper = makeWrapper(['/admin/return-requests/rr-1']);
    render(
      <Wrapper>
        <Routes>
          <Route path="/admin/return-requests/:id" element={<ReviewReturnRequestPage />} />
        </Routes>
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
    });
  });

  it('opens approve confirm dialog on click', async () => {
    const Wrapper = makeWrapper(['/admin/return-requests/rr-1']);
    render(
      <Wrapper>
        <Routes>
          <Route path="/admin/return-requests/:id" element={<ReviewReturnRequestPage />} />
        </Routes>
      </Wrapper>,
    );

    await waitFor(() => screen.getByRole('button', { name: /aprobar/i }));
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }));

    await waitFor(() => {
      expect(screen.getByText(/aprobar solicitud/i)).toBeInTheDocument();
    });
  });

  it('calls approve endpoint and shows toast on confirm', async () => {
    server.use(
      http.post(`${BASE}/return-requests/rr-1/approve`, () =>
        HttpResponse.json({ ...mockRequest, status: 'approved' }),
      ),
    );

    const Wrapper = makeWrapper(['/admin/return-requests/rr-1']);
    render(
      <Wrapper>
        <Routes>
          <Route path="/admin/return-requests/:id" element={<ReviewReturnRequestPage />} />
          <Route path="/admin/return-requests" element={<div>Admin queue</div>} />
        </Routes>
      </Wrapper>,
    );

    await waitFor(() => screen.getByRole('button', { name: /aprobar/i }));
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }));
    await waitFor(() => screen.getByRole('alertdialog'));
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/aprobada/i)).toBeInTheDocument();
    });
  });
});
