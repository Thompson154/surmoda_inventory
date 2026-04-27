import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { AuditLogsPage } from '../AuditLogsPage';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/utils';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

// Seeding the real Zustand store rather than mocking the module. The
// httpClient calls useAuthStore.getState() directly — a partial vi.mock
// breaks that because it replaces the function reference instead of the
// state. setState/getState survive intact this way.
function seedAdmin() {
  useAuthStore.setState({
    accessToken: 'test-token',
    user: {
      id: 'admin-1',
      email: 'admin@test.local',
      fullName: 'Admin Test',
      isAdmin: true,
      assignments: [],
    },
  });
}

// Reusable seeds for the four cases below. Each test re-arms the MSW
// handler so we don't depend on global handler state.
const SEED_ITEMS = [
  {
    id: 'a1',
    timestamp: '2026-04-26T10:00:00.000Z',
    userId: 'user-1',
    userLabel: 'Lucía Vendedora',
    action: 'SALE_CREATED',
    entity: 'Sale',
    entityId: 'sale-1',
    payload: { storeId: 'store-prado-seed', totalCents: 12000 },
    ip: '190.1.2.3',
    userAgent: 'Mozilla',
  },
  {
    id: 'a2',
    timestamp: '2026-04-26T09:55:00.000Z',
    userId: 'user-2',
    userLabel: 'Sofía Encargada',
    action: 'DELIVERY_CONFIRMED',
    entity: 'Delivery',
    entityId: 'd-99',
    payload: { fromStoreId: 'store-almacen-seed', toStoreId: 'store-zsur-seed' },
    ip: '190.1.2.4',
    userAgent: 'Mozilla',
  },
];

describe('AuditLogsPage', () => {
  beforeEach(() => {
    seedAdmin();
    server.use(
      http.get('http://localhost:3000/api/v1/audit-logs', ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        const storeId = url.searchParams.get('storeId');
        const items = SEED_ITEMS.filter((it) => {
          if (userId && it.userId !== userId) return false;
          if (storeId) {
            const p = it.payload as Record<string, unknown>;
            if (p.storeId !== storeId && p.toStoreId !== storeId && p.fromStoreId !== storeId) {
              return false;
            }
          }
          return true;
        });
        return HttpResponse.json({
          items,
          total: items.length,
          page: 1,
          pageSize: 50,
        });
      }),
    );
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('renders the seeded audit rows from the MSW handler', async () => {
    renderWithProviders(<AuditLogsPage />);

    expect(await screen.findByText('SALE_CREATED')).toBeInTheDocument();
    expect(screen.getByText('DELIVERY_CONFIRMED')).toBeInTheDocument();
    expect(screen.getByText('Lucía Vendedora')).toBeInTheDocument();
    expect(screen.getByText('Sofía Encargada')).toBeInTheDocument();
  });

  it('shows the IP and user-agent in muted text below the row', async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText('SALE_CREATED');
    expect(screen.getAllByText(/190\.1\.2\.[34]/).length).toBeGreaterThan(0);
  });

  it('filters by store via the store select', async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText('SALE_CREATED');

    // Pick PRADO — the SALE_CREATED row has payload.storeId=PRADO; the
    // DELIVERY_CONFIRMED row has fromStoreId=ALMACEN, toStoreId=ZSUR. So PRADO
    // should keep only the SALE row. Wait for the refetch to complete:
    // DELIVERY_CONFIRMED has to disappear, not just SALE_CREATED to appear.
    const storeSelect = screen.getByLabelText(/filtrar por sucursal/i);
    fireEvent.change(storeSelect, { target: { value: 'store-prado-seed' } });

    await waitFor(() => {
      expect(screen.queryByText('DELIVERY_CONFIRMED')).toBeNull();
    });
    expect(screen.getByText('SALE_CREATED')).toBeInTheDocument();
  });

  it('shows a header that links back to the admin panel for admins', async () => {
    renderWithProviders(<AuditLogsPage />);
    expect(await screen.findByText(/volver al panel admin/i)).toBeInTheDocument();
  });

  it('renders a payload summary one-liner per row', async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText('SALE_CREATED');
    // The SALE_CREATED payload has storeId + totalCents: the summarizer
    // surfaces both as "key: value · key: value".
    expect(screen.getByText(/storeId: store-prado-seed.*totalCents: 12000/)).toBeInTheDocument();
  });
});
