import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  fromStoreName: 'Almacén Central',
  toStoreName: 'Prado',
  toStoreId: 'store-prado-seed',
  fromStoreId: 'store-almacen-seed',
  totalUnits: 11,
  createdAt: '2026-04-28T10:00:00.000Z',
  items: [
    {
      id: 'di-1',
      productName: 'Blusa Seda',
      productCode: 'BLUSA-SEDA',
      quantity: 11,
      receivedQuantity: null,
    },
  ],
  adjustments: [],
};

const mockDeliveryPartial = {
  ...mockDeliverySent,
  id: 'del-3',
  status: 'partial',
  items: [
    {
      id: 'di-1',
      productName: 'Blusa Seda',
      productCode: 'BLUSA-SEDA',
      quantity: 11,
      receivedQuantity: 10,
    },
  ],
};

const mockDeliveryPartialConfirmed = {
  ...mockDeliveryPartial,
  id: 'del-4',
  status: 'partial_confirmed',
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

describe('DeliveryDetailDrawer — status=sent, encargada', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-enc',
        email: 'enc@surmoda.test',
        fullName: 'Encargada Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'encargada', storeKind: 'branch' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-1`, () => HttpResponse.json(mockDeliverySent)));
  });

  it('does NOT show "Solicitar edición" button anymore', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar recepción/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /solicitar edición/i })).not.toBeInTheDocument();
  });

  it('keeps quantities locked initially and does not show editable input', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar recepción/i })).toBeInTheDocument();
    });
    // The number input is locked initially
    expect(screen.queryByLabelText(/recibidos de blusa-seda/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /editar/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('opens confirmation popup when clicking edit, unlocks inputs and requires reason for partial reception', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /editar/i }).length).toBeGreaterThanOrEqual(1);
    });

    // Click edit button
    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    fireEvent.click(editBtns[0]!);

    // Confirmation popup appears
    expect(
      await screen.findByText(
        /¿está seguro de que quiere editar la recepción porque le llegaron menos productos\?/i,
      ),
    ).toBeInTheDocument();

    // Confirm the popup
    fireEvent.click(screen.getByRole('button', { name: /sí, editar recepción/i }));

    // Now input is editable and discrepancy reason textarea appears
    const input = await screen.findByLabelText(/recibidos de blusa-seda/i);
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '10' } });

    // The CTA switches to "Recibir recepción parcialmente"
    const partialBtn = screen.getByRole('button', { name: /recibir recepción parcialmente/i });
    expect(partialBtn).toBeInTheDocument();

    // Disabled because reason is mandatory
    expect(partialBtn).toBeDisabled();
    expect(screen.getByText(/el motivo es obligatorio/i)).toBeInTheDocument();

    // Fill discrepancy reason
    const reasonTextarea = screen.getByLabelText(/motivo de la discrepancia \/ mermas/i);
    fireEvent.change(reasonTextarea, {
      target: { value: 'Llegó 1 prenda menos en la caja sellada' },
    });

    // Now enabled!
    expect(partialBtn).not.toBeDisabled();
  });
});

describe('DeliveryDetailDrawer — status=sent, vendedora', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-vend',
        email: 'vend@surmoda.test',
        fullName: 'Vendedora Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'vendedora', storeKind: 'branch' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-1`, () => HttpResponse.json(mockDeliverySent)));
  });

  it('does NOT show Confirmar or Solicitar edición buttons for vendedora', async () => {
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
    expect(screen.queryByRole('button', { name: /confirmar recepción/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /solicitar edición/i })).not.toBeInTheDocument();
  });
});

describe('DeliveryDetailDrawer — status=partial', () => {
  it('shows waiting message (no confirm button) to receiving branch encargada', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-prado',
        email: 'prado@surmoda.test',
        fullName: 'Prado',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'encargada', storeKind: 'branch' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-3`, () => HttpResponse.json(mockDeliveryPartial)));

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-3" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText(/esperando confirmación interna/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /confirmar recepción parcial/i }),
    ).not.toBeInTheDocument();
  });

  it('allows warehouse encargada to confirm partial reception', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-gloria',
        email: 'gloria@surmoda.test',
        fullName: 'Gloria',
        isAdmin: false,
        assignments: [{ storeId: 'store-almacen-seed', role: 'encargada', storeKind: 'warehouse' }],
      },
    });
    let confirmedCalled = false;
    server.use(
      http.get(`${BASE}/deliveries/del-3`, () => HttpResponse.json(mockDeliveryPartial)),
      http.post(`${BASE}/deliveries/del-3/confirm-partial`, () => {
        confirmedCalled = true;
        return HttpResponse.json(mockDeliveryPartialConfirmed);
      }),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-3" onClose={vi.fn()} />
      </Wrapper>,
    );
    const btn = await screen.findByRole('button', { name: /confirmar recepción parcial/i });
    fireEvent.click(btn);
    fireEvent.click(await screen.findByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => expect(confirmedCalled).toBe(true));
  });

  it('hides "Confirmar recepción parcial" for admin while viewing from destination branch, and allows it from Almacén Central', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-admin',
        email: 'admin@surmoda.test',
        fullName: 'Admin Test',
        isAdmin: true,
        assignments: [],
      },
    });
    const partialWithAdjustment = {
      ...mockDeliveryPartial,
      adjustments: [
        {
          id: 'adj-1',
          deliveryItemId: 'di-1',
          expectedQty: 11,
          actualQty: 10,
          reason: 'Solo llegaron 10',
          adjustedByUserId: 'user-prado',
          adjustedByFullName: 'Sucursal Prado',
          createdAt: '2026-04-28T11:00:00.000Z',
        },
      ],
    };
    server.use(
      http.get(`${BASE}/deliveries/del-3`, () => HttpResponse.json(partialWithAdjustment)),
    );

    const qcBranch = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={qcBranch}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/sedes/store-prado-seed/entregas']}>
            <Routes>
              <Route
                path="/sedes/:storeId/entregas"
                element={<DeliveryDetailDrawer deliveryId="del-3" onClose={vi.fn()} />}
              />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Recibido parcialmente · En revisión/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Ve a Almacén Central/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /confirmar recepción parcial/i }),
    ).not.toBeInTheDocument();
    unmount();

    const qcWarehouse = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qcWarehouse}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/sedes/store-almacen-seed/entregas']}>
            <Routes>
              <Route
                path="/sedes/:storeId/entregas"
                element={<DeliveryDetailDrawer deliveryId="del-3" onClose={vi.fn()} />}
              />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Solo llegaron 10/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /confirmar recepción parcial/i }),
    ).toBeInTheDocument();
  });
});

describe('DeliveryDetailDrawer — admin delete sent delivery', () => {
  it('shows "Eliminar envío" ONLY for admin on sent deliveries and deletes on confirm', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-enc',
        email: 'enc@surmoda.test',
        fullName: 'Encargada Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'encargada', storeKind: 'branch' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-1`, () => HttpResponse.json(mockDeliverySent)));

    const WrapperEnc = makeWrapper();
    const { unmount } = render(
      <WrapperEnc>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={vi.fn()} />
      </WrapperEnc>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar recepción/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /eliminar envío/i })).not.toBeInTheDocument();
    unmount();

    // Non-sent delivery (received) must NOT show delete even for admin
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-admin',
        email: 'admin@surmoda.test',
        fullName: 'Admin Test',
        isAdmin: true,
        assignments: [],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-2`, () => HttpResponse.json(mockDeliveryReceived)));
    const WrapperRec = makeWrapper();
    const { unmount: unmountRec } = render(
      <WrapperRec>
        <DeliveryDetailDrawer deliveryId="del-2" onClose={vi.fn()} />
      </WrapperRec>,
    );
    await waitFor(() => {
      expect(screen.getByText(/entrega confirmada/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /eliminar envío/i })).not.toBeInTheDocument();
    unmountRec();

    // Admin on sent delivery sees "Eliminar envío" and DELETEs on confirm
    let deletedCalled = false;
    const onClose = vi.fn();
    server.use(
      http.get(`${BASE}/deliveries/del-1`, () => HttpResponse.json(mockDeliverySent)),
      http.delete(`${BASE}/deliveries/del-1`, () => {
        deletedCalled = true;
        return HttpResponse.json({ deleted: true, id: 'del-1' });
      }),
    );

    const WrapperAdmin = makeWrapper();
    render(
      <WrapperAdmin>
        <DeliveryDetailDrawer deliveryId="del-1" onClose={onClose} />
      </WrapperAdmin>,
    );
    const delBtn = await screen.findByRole('button', { name: /eliminar envío/i });
    fireEvent.click(delBtn);

    const confirmDialogBtns = await screen.findAllByRole('button', { name: /eliminar envío/i });
    fireEvent.click(confirmDialogBtns[confirmDialogBtns.length - 1]!);

    await waitFor(() => expect(deletedCalled).toBe(true));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('DeliveryDetailDrawer — status=received & partial_confirmed', () => {
  it('shows confirmed label when status=received', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-enc',
        email: 'enc@surmoda.test',
        fullName: 'Encargada Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'encargada', storeKind: 'branch' }],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-2`, () => HttpResponse.json(mockDeliveryReceived)));

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

  it('shows "Recibido parcialmente - Confirmado" when status=partial_confirmed', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-enc',
        email: 'enc@surmoda.test',
        fullName: 'Encargada Test',
        isAdmin: false,
        assignments: [{ storeId: 'store-prado-seed', role: 'encargada', storeKind: 'branch' }],
      },
    });
    server.use(
      http.get(`${BASE}/deliveries/del-4`, () => HttpResponse.json(mockDeliveryPartialConfirmed)),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-4" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getAllByText(/recibido parcialmente - confirmado/i).length).toBeGreaterThan(0);
    });
  });

  it('renders "Eliminar entrega (revertir stock)" for admin when delivery is received', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-admin',
        email: 'admin@surmoda.test',
        fullName: 'Admin Test',
        isAdmin: true,
        assignments: [],
      },
    });
    server.use(http.get(`${BASE}/deliveries/del-2`, () => HttpResponse.json(mockDeliveryReceived)));

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-2" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /eliminar entrega \(revertir stock\)/i }),
      ).toBeInTheDocument();
    });
  });

  it('renders "Eliminar entrega (revertir stock)" for admin when delivery is partial_confirmed', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'user-admin',
        email: 'admin@surmoda.test',
        fullName: 'Admin Test',
        isAdmin: true,
        assignments: [],
      },
    });
    server.use(
      http.get(`${BASE}/deliveries/del-4`, () => HttpResponse.json(mockDeliveryPartialConfirmed)),
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeliveryDetailDrawer deliveryId="del-4" onClose={vi.fn()} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /eliminar entrega \(revertir stock\)/i }),
      ).toBeInTheDocument();
    });
  });
});
