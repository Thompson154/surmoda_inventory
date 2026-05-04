import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { SalesRegisterPage } from '../SalesRegisterPage';
import { server } from '@/test/server';
import { makeQueryClient } from '@/test/utils';
import { ToastProvider } from '@/shared/ui';

const BASE = 'http://localhost:3000/api/v1';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/sedes/store-prado-seed/scanner']}>
          <Routes>
            <Route path="/sedes/:storeId/scanner" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

const todayIso = new Date().toISOString();

const saleWithDiscount = {
  id: 'sale-1',
  storeId: 'store-prado-seed',
  paymentMethod: 'cash',
  totalCents: 20000,
  totalUnits: 1,
  createdAt: todayIso,
  items: [
    {
      id: 'item-1',
      variantId: 'v-1',
      productCode: 'PROD-001',
      productName: 'Remera',
      size: 'M',
      color: 'rojo',
      imagePath: null,
      quantity: 1,
      priceAtSaleCents: 20000,
      // WHY: subtotalCents < priceAtSaleCents → discount case
      subtotalCents: 17000,
    },
  ],
};

const saleWithoutDiscount = {
  id: 'sale-2',
  storeId: 'store-prado-seed',
  paymentMethod: 'qr',
  totalCents: 15000,
  totalUnits: 1,
  createdAt: todayIso,
  items: [
    {
      id: 'item-2',
      variantId: 'v-2',
      productCode: 'PROD-002',
      productName: 'Pantalón',
      size: 'L',
      color: 'negro',
      imagePath: null,
      quantity: 1,
      priceAtSaleCents: 15000,
      subtotalCents: 15000,
    },
  ],
};

afterEach(() => {
  server.resetHandlers();
});

describe('SalesRegisterPage — today list discount display', () => {
  it('shows subtotal amount for a discounted item', async () => {
    server.use(
      http.get(`${BASE}/stores/store-prado-seed/sales`, () =>
        HttpResponse.json({ items: [saleWithDiscount], total: 1, page: 1, pageSize: 50 }),
      ),
      http.get(`${BASE}/stores`, () => HttpResponse.json({ items: [], total: 0 })),
    );

    render(
      <Wrapper>
        <SalesRegisterPage />
      </Wrapper>,
    );

    // subtotalCents = 17000 → Bs 170
    await waitFor(() => {
      expect(screen.getByText(/Bs 170/i)).toBeInTheDocument();
    });
  });

  it('shows strikethrough original price for discounted items', async () => {
    server.use(
      http.get(`${BASE}/stores/store-prado-seed/sales`, () =>
        HttpResponse.json({ items: [saleWithDiscount], total: 1, page: 1, pageSize: 50 }),
      ),
      http.get(`${BASE}/stores`, () => HttpResponse.json({ items: [], total: 0 })),
    );

    render(
      <Wrapper>
        <SalesRegisterPage />
      </Wrapper>,
    );

    // catalogTotalCents = 20000 → Bs 200 crossed out
    await waitFor(() => {
      const strikethrough = document.querySelector('.line-through');
      expect(strikethrough).not.toBeNull();
      expect(strikethrough?.textContent).toMatch(/200/);
    });
  });

  it('does NOT show strikethrough for items without discount', async () => {
    server.use(
      http.get(`${BASE}/stores/store-prado-seed/sales`, () =>
        HttpResponse.json({ items: [saleWithoutDiscount], total: 1, page: 1, pageSize: 50 }),
      ),
      http.get(`${BASE}/stores`, () => HttpResponse.json({ items: [], total: 0 })),
    );

    render(
      <Wrapper>
        <SalesRegisterPage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Bs 150/i).length).toBeGreaterThan(0);
    });

    // No strikethrough should be present in ItemSaleCard area (the tiny crossed-out price)
    const strikethrough = document.querySelector('p.line-through');
    expect(strikethrough).toBeNull();
  });
});
