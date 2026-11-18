/**
 * Wave 5 — inventory RBAC hardening tests.
 *
 * Validates:
 *  - Vendedora is redirected away from /inventario (ProtectedRoute blocks)
 *  - Admin/encargada can access the page
 *  - "Edición por vendedoras" toggle card is NOT rendered for any role (removed in Wave 5)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { AuthUser } from '@surmoda/contracts';
import { SedeInventoryPage } from '../SedeInventoryPage';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { server } from '@/test/server';

const STORE_ID = 'store-prado-seed';
const BASE = 'http://localhost:3000/api/v1';

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };

function setupHandlers() {
  server.use(
    http.get(`${BASE}/stores/:storeId/inventory/grouped`, () => HttpResponse.json(EMPTY_PAGE)),
    http.get(`${BASE}/stores/:storeId/inventory/permission`, () =>
      HttpResponse.json({ isEnabled: false }),
    ),
    http.get(`${BASE}/stores`, () =>
      HttpResponse.json({
        items: [
          {
            id: STORE_ID,
            code: 'PRADO',
            name: 'Sucursal Prado',
            kind: 'branch',
            isActive: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
      }),
    ),
  );
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function setUser(user: AuthUser | null) {
  useAuthStore.setState({ user });
}

function renderInventoryRoute(user: AuthUser | null) {
  setUser(user);
  setupHandlers();
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/sedes/${STORE_ID}/inventario`]}>
        <Routes>
          <Route path="/sedes" element={<div>sedes page</div>} />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/sales/register" element={<div>sales register</div>} />
          <Route
            path="/sedes/:storeId/inventario"
            element={
              <ProtectedRoute action="inventory:read" fallback="/sedes">
                <SedeInventoryPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const adminUser: AuthUser = {
  id: 'a1',
  email: 'admin@test.com',
  fullName: 'Admin User',
  isAdmin: true,
  assignments: [],
};

const vendedoraUser: AuthUser = {
  id: 'v1',
  email: 'v@test.com',
  fullName: 'Vendedora',
  isAdmin: false,
  assignments: [{ storeId: STORE_ID, role: 'vendedora' }],
};

const encargadaUser: AuthUser = {
  id: 'e1',
  email: 'e@test.com',
  fullName: 'Encargada',
  isAdmin: false,
  assignments: [{ storeId: STORE_ID, role: 'encargada' }],
};

describe('SedeInventoryPage — Wave 5 RBAC', () => {
  afterEach(() => setUser(null));
  it('vendedora is redirected away from /inventario (no inventory:read)', () => {
    renderInventoryRoute(vendedoraUser);
    // ProtectedRoute redirects vendedora to /sedes (fallback in App.tsx)
    expect(screen.getByText('sedes page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inventario' })).not.toBeInTheDocument();
  });

  it('admin can access inventory page — h1 renders immediately', () => {
    renderInventoryRoute(adminUser);
    // h1 renders synchronously before any data loading
    expect(screen.getByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
  });

  it('encargada can access inventory page — h1 renders immediately', () => {
    renderInventoryRoute(encargadaUser);
    expect(screen.getByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
  });

  it('does NOT render "Edición por vendedoras" toggle card for admin (removed in Wave 5)', () => {
    renderInventoryRoute(adminUser);
    expect(screen.queryByText('Edición por vendedoras')).not.toBeInTheDocument();
  });

  it('does NOT render "Edición por vendedoras" toggle card for encargada (removed in Wave 5)', () => {
    renderInventoryRoute(encargadaUser);
    expect(screen.queryByText('Edición por vendedoras')).not.toBeInTheDocument();
  });

  it('shows exact variant for hashed barcode and product with variants for product code search', async () => {
    renderInventoryRoute(adminUser);
    server.use(
      http.get(`${BASE}/stores/:storeId/inventory`, ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get('q') ?? '').toUpperCase();
        if (q === 'AABBCCDDEEFF') {
          return HttpResponse.json({
            items: [
              {
                variantId: 'v-1',
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
            ],
            total: 1,
            page: 1,
            pageSize: 50,
          });
        }
        return HttpResponse.json({
          items: [
            {
              variantId: 'v-1',
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
              variantId: 'v-2',
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
          pageSize: 50,
        });
      }),
    );

    const searchInput = await screen.findByLabelText(/buscar inventario/i);
    fireEvent.change(searchInput, { target: { value: 'AABBCCDDEEFF' } });

    await waitFor(() => {
      expect(screen.getByText(/Coincidencia por código de barras/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Blusa Seda/i)).toBeInTheDocument();
    expect(screen.getByText(/BLUSA-SEDA/i)).toBeInTheDocument();
    expect(screen.queryByText(/AABBCCDDEEFF/i)).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'BLUSA-SEDA' } });

    await waitFor(() => {
      expect(screen.getByText(/2 variantes/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/blanco/i)).toBeInTheDocument();
    expect(screen.getByText(/negro/i)).toBeInTheDocument();
    expect(screen.queryByText(/AABBCCDDEEFF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/112233445566/i)).not.toBeInTheDocument();
  });
});
