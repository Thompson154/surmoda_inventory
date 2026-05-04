/**
 * Wave 5 — SingleVariantQuickEditModal ConfirmDialog integration.
 *
 * When admin clicks "Guardar", a ConfirmDialog must open requiring a reason
 * (minLength=3). Confirm fires the PATCH only after valid reason is entered.
 */
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { AuthUser, InventoryRow } from '@surmoda/contracts';
import { SingleVariantQuickEditModal } from '../SingleVariantQuickEditModal';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

const adminUser: AuthUser = {
  id: 'a1',
  email: 'admin@test.com',
  fullName: 'Admin',
  isAdmin: true,
  assignments: [],
};

const encargadaUser: AuthUser = {
  id: 'e1',
  email: 'e@test.com',
  fullName: 'Encargada',
  isAdmin: false,
  assignments: [{ storeId: 's1', role: 'encargada' }],
};

const fakeRow: InventoryRow = {
  productId: 'p1',
  productCode: 'JN001',
  productName: 'Jean Bota Recta',
  imagePath: null,
  variantId: 'v1',
  barcode: 'ABC123',
  size: 'm',
  color: 'azul',
  priceCents: 15000,
  quantity: 5,
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('SingleVariantQuickEditModal — ConfirmDialog (Wave 5)', () => {
  afterEach(() => useAuthStore.setState({ user: null }));
  it('admin: clicking Guardar opens ConfirmDialog instead of submitting directly', async () => {
    useAuthStore.setState({ user: adminUser });
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <SingleVariantQuickEditModal storeId="s1" row={fakeRow} canEdit={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    // Change quantity to make dirty
    const minusBtn = screen.getByRole('button', { name: 'Restar' });
    fireEvent.click(minusBtn);

    // Click Guardar — should open ConfirmDialog, not fire PATCH directly
    const guardarBtn = screen.getByRole('button', { name: 'Guardar' });
    fireEvent.click(guardarBtn);

    // ConfirmDialog title must be visible
    await waitFor(() =>
      expect(screen.getByText('Confirmar edición de inventario')).toBeInTheDocument(),
    );
  });

  it('confirm button in dialog is disabled while reason has fewer than 3 chars', async () => {
    useAuthStore.setState({ user: adminUser });
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <SingleVariantQuickEditModal storeId="s1" row={fakeRow} canEdit={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    const minusBtn = screen.getByRole('button', { name: 'Restar' });
    fireEvent.click(minusBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByText('Confirmar edición de inventario')).toBeInTheDocument(),
    );

    // Type < 3 chars
    const textarea = screen.getByLabelText('Motivo');
    await userEvent.type(textarea, 'ab');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('confirm button enables after entering ≥3 char reason', async () => {
    useAuthStore.setState({ user: adminUser });
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <SingleVariantQuickEditModal storeId="s1" row={fakeRow} canEdit={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    const minusBtn = screen.getByRole('button', { name: 'Restar' });
    fireEvent.click(minusBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByText('Confirmar edición de inventario')).toBeInTheDocument(),
    );

    const textarea = screen.getByLabelText('Motivo');
    await userEvent.type(textarea, 'ajuste por conteo');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
  });

  it('confirming with valid reason fires the PATCH (adjust mutate)', async () => {
    const patchSpy = vi.fn();
    server.use(
      // WHY: endpoint is /stores/:storeId/inventory/:variantId (no /adjust suffix)
      http.patch(`${BASE}/stores/:storeId/inventory/:variantId`, async () => {
        patchSpy();
        return HttpResponse.json({
          variantId: 'v1',
          quantity: 4,
          previous: 5,
          delta: -1,
          productId: 'p1',
          productCode: 'JN001',
          productName: 'Jean Bota Recta',
          imagePath: null,
          barcode: 'ABC123',
          size: 'm',
          color: 'azul',
          priceCents: 15000,
        });
      }),
    );

    useAuthStore.setState({ user: adminUser });
    const client = makeClient();
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <SingleVariantQuickEditModal storeId="s1" row={fakeRow} canEdit={true} onClose={onClose} />
      </QueryClientProvider>,
    );

    const minusBtn = screen.getByRole('button', { name: 'Restar' });
    fireEvent.click(minusBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByText('Confirmar edición de inventario')).toBeInTheDocument(),
    );

    const textarea = screen.getByLabelText('Motivo');
    await userEvent.type(textarea, 'ajuste por conteo');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
  });

  it('non-admin (canEdit=false) does NOT show Guardar button (readonly view)', () => {
    useAuthStore.setState({ user: encargadaUser });
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <SingleVariantQuickEditModal storeId="s1" row={fakeRow} canEdit={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    // Guardar button should not exist when canEdit=false
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    // Solo lectura badge should be visible
    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
  });
});
