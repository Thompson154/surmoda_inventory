import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { DeliveryDetailDrawer } from '../DeliveryDetailDrawer';
import { server } from '@/test/server';
import { ToastProvider } from '@/shared/ui';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

const BASE = 'http://localhost:3000/api/v1';

const mockDeliverySent = {
  id: 'del-1',
  number: 1,
  status: 'sent',
  title: 'Entrega test',
  note: null,
  fromStoreName: 'Almacén',
  toStoreName: 'Prado',
  toStoreId: 'store-prado-seed',
  fromStoreId: 'store-almacen-seed',
  totalUnits: 2,
  createdAt: '2026-04-28T10:00:00.000Z',
  items: [
    {
      id: 'di-1',
      productName: 'Jean Azul',
      productCode: 'JN001',
      quantity: 2,
      receivedQuantity: null,
    },
  ],
  adjustments: [],
};

const mockDeliveryReceived = {
  ...mockDeliverySent,
  id: 'del-2',
  status: 'received',
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

// ---------- sent status — encargada ----------

describe('DeliveryDetailDrawer — status=sent, encargada', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-enc',
        email: 'enc@surmoda.test',
        fullName: 'Encargada Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'encargada' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-1`, () => HttpResponse.json(mockDeliverySent)));
  });

  it('shows "Solicitar edición" button when status is sent', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /solicitar edición/i })).toBeInTheDocument();
    });
  });

  it('shows "Confirmar recepción" button for encargada on sent delivery', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar recepción/i })).toBeInTheDocument();
    });
  });

  it('opens edit request modal when "Solicitar edición" is clicked', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => screen.getByRole('button', { name: /solicitar edición/i }));
    fireEvent.click(screen.getByRole('button', { name: /solicitar edición/i }));
    await waitFor(() => {
      expect(screen.getByText(/solicitar edición de entrega/i)).toBeInTheDocument();
    });
  });

  it('submits edit request and shows success toast', async () => {
    server.use(
      http.post(`${BASE}/deliveries/del-1/edit-requests`, () =>
        HttpResponse.json(
          { id: 'der-1', deliveryId: 'del-1', reason: 'x'.repeat(50), status: 'pending' },
          { status: 201 },
        ),
      ),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => screen.getByRole('button', { name: /solicitar edición/i }));
    fireEvent.click(screen.getByRole('button', { name: /solicitar edición/i }));
    await waitFor(() => screen.getByText(/solicitar edición de entrega/i));

    // Type reason in confirm dialog textarea
    const textarea = screen.getByRole('textbox', { name: /motivo/i });
    fireEvent.change(textarea, { target: { value: 'a'.repeat(50) } });

    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/solicitud enviada al admin/i)).toBeInTheDocument();
    });
  });
});

// ---------- sent status — vendedora ----------

describe('DeliveryDetailDrawer — status=sent, vendedora', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-vend',
        email: 'vend@surmoda.test',
        fullName: 'Vendedora Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'vendedora' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-1`, () => HttpResponse.json(mockDeliverySent)));
  });

  it('shows "Solicitar edición" button for vendedora on sent delivery', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /solicitar edición/i })).toBeInTheDocument();
    });
  });

  it('does NOT show "Confirmar recepción" button for vendedora', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => screen.getByRole('button', { name: /solicitar edición/i }));
    expect(screen.queryByRole('button', { name: /confirmar recepción/i })).not.toBeInTheDocument();
  });

  it('shows "Solo encargada/admin puede confirmar recepción" note for vendedora', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(
        screen.getByText(/solo encargada\/admin puede confirmar recepción/i),
      ).toBeInTheDocument();
    });
  });
});

// ---------- received status ----------

describe('DeliveryDetailDrawer — status=received', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-enc',
        email: 'enc@surmoda.test',
        fullName: 'Encargada Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'encargada' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-2`, () => HttpResponse.json(mockDeliveryReceived)));
  });

  it('shows confirmed label when status=received', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-2" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText(/entrega confirmada — no se puede modificar/i)).toBeInTheDocument();
    });
  });

  it('does NOT show "Solicitar edición" when status=received', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-2" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => screen.getByText(/entrega confirmada — no se puede modificar/i));
    expect(screen.queryByRole('button', { name: /solicitar edición/i })).not.toBeInTheDocument();
  });
});
