import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { CashierModal } from '../CashierModal';
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
  onSold: vi.fn(),
};

const mockInventoryRow = {
  variantId: 'v-1',
  productCode: 'PROD-001',
  productName: 'Remera básica',
  size: 'M',
  color: 'rojo',
  priceCents: 20000,
  quantity: 10,
  storeId: 'store-prado-seed',
  imagePath: null,
};

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

async function addItemToCart(barcode = 'BARCODE-TEST') {
  server.use(
    http.get(`${BASE}/stores/store-prado-seed/inventory/by-barcode/${barcode}`, () =>
      HttpResponse.json(mockInventoryRow),
    ),
  );

  const barcodeInput = screen.getByPlaceholderText(/pegá o escribí el código/i);
  fireEvent.change(barcodeInput, { target: { value: barcode } });
  const addBtn = screen.getByRole('button', { name: /agregar/i });
  fireEvent.click(addBtn);

  // Wait for cart row to appear
  await waitFor(() => {
    expect(screen.getByLabelText(/subtotal/i)).toBeInTheDocument();
  });
}

describe('CashierModal subtotal validation', () => {
  it('shows no discount error when subtotal equals total (no discount)', async () => {
    render(
      <Wrapper>
        <CashierModal {...defaultProps} />
      </Wrapper>,
    );

    await addItemToCart();

    // There should be no error initially (subtotal = total)
    expect(screen.queryByText(/descuento máx/i)).not.toBeInTheDocument();
  });

  it('shows discount error when subtotal is less than 70% of total', async () => {
    render(
      <Wrapper>
        <CashierModal {...defaultProps} />
      </Wrapper>,
    );

    await addItemToCart();

    // Total is 200.00 (priceCents 20000). 70% = 140.00. Set subtotal to 100.00.
    const subtotalInput = screen.getByLabelText(/subtotal/i);
    fireEvent.change(subtotalInput, { target: { value: '100.00' } });

    await waitFor(() => {
      expect(screen.getByText(/descuento máx 30%/i)).toBeInTheDocument();
    });
  });

  it('disables the charge button when any subtotal is invalid', async () => {
    render(
      <Wrapper>
        <CashierModal {...defaultProps} />
      </Wrapper>,
    );

    await addItemToCart();

    // Set subtotal too low (below 70% of 200.00)
    const subtotalInput = screen.getByLabelText(/subtotal/i);
    fireEvent.change(subtotalInput, { target: { value: '100.00' } });

    await waitFor(() => {
      const chargeBtn = screen.getByRole('button', { name: /cobrar/i });
      expect(chargeBtn).toBeDisabled();
    });
  });

  it('does NOT disable charge button when subtotal is exactly 70% of total', async () => {
    render(
      <Wrapper>
        <CashierModal {...defaultProps} />
      </Wrapper>,
    );

    await addItemToCart();

    // 70% of 200.00 = 140.00
    const subtotalInput = screen.getByLabelText(/subtotal/i);
    fireEvent.change(subtotalInput, { target: { value: '140.00' } });

    await waitFor(() => {
      expect(screen.queryByText(/descuento máx 30%/i)).not.toBeInTheDocument();
    });
    const chargeBtn = screen.getByRole('button', { name: /cobrar/i });
    expect(chargeBtn).not.toBeDisabled();
  });
});
