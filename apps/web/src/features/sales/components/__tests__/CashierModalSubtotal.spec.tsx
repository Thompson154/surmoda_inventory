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

  it('lists matching variants when searching by product code instead of hashed barcode', async () => {
    server.use(
      http.get(`${BASE}/stores/store-prado-seed/inventory/by-barcode/BLUSA-SEDA`, () =>
        HttpResponse.json(
          { code: 'STOCK_BARCODE_NOT_FOUND', message: 'No encontrado' },
          { status: 404 },
        ),
      ),
      http.get(`${BASE}/stores/store-prado-seed/inventory`, () =>
        HttpResponse.json({
          items: [
            {
              variantId: 'v-s-blanco',
              productId: 'p-1',
              productCode: 'BLUSA-SEDA',
              productName: 'Blusa Seda',
              size: 's',
              color: 'blanco',
              barcode: 'AABBCCDDEEFF',
              priceCents: 15000,
              imagePath: null,
              quantity: 4,
            },
            {
              variantId: 'v-m-negro',
              productId: 'p-1',
              productCode: 'BLUSA-SEDA',
              productName: 'Blusa Seda',
              size: 'm',
              color: 'negro',
              barcode: '112233445566',
              priceCents: 15000,
              imagePath: null,
              quantity: 2,
            },
          ],
          total: 2,
          page: 1,
          pageSize: 30,
        }),
      ),
    );

    render(
      <Wrapper>
        <CashierModal {...defaultProps} />
      </Wrapper>,
    );

    const input = screen.getByPlaceholderText(/pegá o escribí el código/i);
    fireEvent.change(input, { target: { value: 'BLUSA-SEDA' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Elegí la prenda a vender \(2\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/blanco/i)).toBeInTheDocument();
    expect(screen.getByText(/negro/i)).toBeInTheDocument();

    const pickButtons = screen.getAllByRole('button', { name: /elegir/i });
    fireEvent.click(pickButtons[1]!);

    await waitFor(() => {
      expect(screen.getByLabelText(/subtotal/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/negro/i)).toBeInTheDocument();
  });

  it('auto-suggests similar product codes and variants while typing (e.g. TES -> TEST001)', async () => {
    server.use(
      http.get(`${BASE}/stores/store-prado-seed/inventory`, () =>
        HttpResponse.json({
          items: [
            {
              variantId: 'v-test-s',
              productId: 'p-test',
              productCode: 'TEST001',
              productName: 'Test Ropa',
              size: 's',
              color: 'azul',
              barcode: 'E3D534509E2C',
              priceCents: 12000,
              imagePath: null,
              quantity: 3,
            },
            {
              variantId: 'v-test-m',
              productId: 'p-test',
              productCode: 'TEST001',
              productName: 'Test Ropa',
              size: 'm',
              color: 'rojo',
              barcode: 'E3D534509E2D',
              priceCents: 12000,
              imagePath: null,
              quantity: 5,
            },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        }),
      ),
    );

    render(
      <Wrapper>
        <CashierModal {...defaultProps} />
      </Wrapper>,
    );

    const input = screen.getByPlaceholderText(/pegá o escribí el código/i);
    fireEvent.change(input, { target: { value: 'TES' } });

    await waitFor(() => {
      expect(screen.getByText(/Elegí la prenda a vender \(2\)/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText('TEST001').length).toBe(2);
    expect(screen.getByText(/azul/i)).toBeInTheDocument();
    expect(screen.getByText(/rojo/i)).toBeInTheDocument();
  });
});
