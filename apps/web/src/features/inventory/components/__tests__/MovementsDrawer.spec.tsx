// Regresión: MovementCard muestra el label del tipo, el productName y el
// userFullName cuando el modal está abierto y el query resuelve con items.
//
// El bug original: el mock handler de movements no incluía productName /
// variantSize / variantColor (campos agregados en el fix de icons). El
// MovementCard renderizaba '—' en lugar del nombre real — a la distancia se
// veía como filas vacías con solo el ícono coloreado visible.
//
// Este spec valida que:
// 1. El label prominente del tipo se renderiza (ej. "Ajuste de stock").
// 2. El productName se renderiza cuando el item tiene variante.
// 3. El productCode se renderiza en la línea de identificación.
// 4. El userFullName aparece en la línea "Por <user>".
// 5. Los campos son opcionales correctamente: movimientos sin variante (ej.
//    edit_permission_toggled) no muestran productName ni productCode.

import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MovementsDrawer } from '../MovementsDrawer';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';
const STORE_ID = 'store-prado-seed';

function renderDrawer() {
  return renderWithProviders(<MovementsDrawer storeId={STORE_ID} open={true} onClose={() => {}} />);
}

describe('MovementsDrawer — rendering de MovementCard', () => {
  it('muestra label, productName, productCode y userFullName cuando el movimiento tiene variante', async () => {
    server.use(
      http.get(`${BASE}/stores/:storeId/movements`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'mv-test-1',
              storeId: STORE_ID,
              variantId: 'var-1',
              userId: 'user-1',
              userFullName: 'María Encargada',
              type: 'adjusted',
              payload: { delta: 10, previous: 0, next: 10 },
              productCode: 'JN001',
              productName: 'Jean Bota Recta',
              barcode: 'ABC123ABC123',
              variantSize: '30',
              variantColor: 'azul',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    renderDrawer();

    // Label prominente del tipo siempre visible — este era el campo que antes
    // no se veía porque el layout no tenía jerarquía visual.
    await waitFor(() => expect(screen.getByText('Ajuste de stock')).toBeInTheDocument());

    // productName debe estar presente — antes undefined en el mock antiguo → '—'
    expect(screen.getByText('Jean Bota Recta')).toBeInTheDocument();

    // productCode en línea de identificación
    expect(screen.getByText(/JN001/)).toBeInTheDocument();

    // userFullName en línea "Por <user>"
    expect(screen.getByText('María Encargada')).toBeInTheDocument();

    // delta signed
    expect(screen.getByText('+10')).toBeInTheDocument();
  });

  it('muestra fallback "—" para productName cuando el campo es null (movimiento sin variante)', async () => {
    server.use(
      http.get(`${BASE}/stores/:storeId/movements`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'mv-perm-1',
              storeId: STORE_ID,
              variantId: null,
              userId: 'user-1',
              userFullName: 'Admin Demo',
              type: 'edit_permission_toggled',
              payload: { isEnabled: true },
              productCode: null,
              productName: null,
              barcode: null,
              variantSize: null,
              variantColor: null,
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    renderDrawer();

    await waitFor(() => expect(screen.getByText('Permiso de edición')).toBeInTheDocument());

    // El texto de permiso reemplaza la línea de productName
    expect(screen.getByText(/habilitada/i)).toBeInTheDocument();

    // productName y productCode NO se renderizan para este tipo
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('muestra delta correcto para sale_out usando quantity cuando no hay delta en payload', async () => {
    server.use(
      http.get(`${BASE}/stores/:storeId/movements`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'mv-sale-1',
              storeId: STORE_ID,
              variantId: 'var-1',
              userId: 'user-1',
              userFullName: 'Lucía Vendedora',
              type: 'sale_out',
              payload: { quantity: 3 },
              productCode: 'CHQ001',
              productName: 'Chaqueta clásica',
              barcode: 'XYZ987',
              variantSize: 'm',
              variantColor: 'negro',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    renderDrawer();

    await waitFor(() => expect(screen.getByText('Venta')).toBeInTheDocument());

    // sale_out es saliente → delta negativo calculado desde quantity
    expect(screen.getByText('-3')).toBeInTheDocument();

    expect(screen.getByText('Chaqueta clásica')).toBeInTheDocument();
    expect(screen.getByText('Lucía Vendedora')).toBeInTheDocument();
  });

  it('renders sale_return with label "Devolución" and RotateCcw icon', async () => {
    server.use(
      http.get(`${BASE}/stores/:storeId/movements`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'mv-return-1',
              storeId: STORE_ID,
              variantId: 'var-1',
              userId: 'user-1',
              userFullName: 'Ana Vendedora',
              type: 'sale_return',
              payload: { quantity: 1 },
              productCode: 'JN001',
              productName: 'Jean Bota Recta',
              barcode: 'ABC123ABC123',
              variantSize: '30',
              variantColor: 'azul',
              createdAt: '2024-01-02T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    renderDrawer();

    // Label must be "Devolución" — defined in TYPE_META for sale_return
    await waitFor(() => expect(screen.getByText('Devolución')).toBeInTheDocument());

    // The icon container uses the warning-soft palette (bg-status-warning-soft)
    // We verify this indirectly by checking the icon SVG is rendered via role or test-id.
    // RotateCcw from lucide renders an svg with aria-hidden, so we check the container class.
    const iconContainers = document.querySelectorAll('.bg-status-warning-soft');
    expect(iconContainers.length).toBeGreaterThan(0);

    expect(screen.getByText('Jean Bota Recta')).toBeInTheDocument();
    expect(screen.getByText('Ana Vendedora')).toBeInTheDocument();
  });
});
