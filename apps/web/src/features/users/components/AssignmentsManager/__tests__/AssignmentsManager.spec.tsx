// T099 — AssignmentsManager component tests (R4 MSW)
// WHY: ensure assignments list renders, reacts to API data, handles add/change/remove
//      and shows the admin fallback message.

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { AssignmentsManager } from '../index';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

const USER_ID = 'user-1';

describe('AssignmentsManager', () => {
  it('renders empty state when API returns no items', async () => {
    renderWithProviders(<AssignmentsManager userId={USER_ID} isUserAdmin={false} />);
    await screen.findByText(/sin asignaciones aún/i);
  });

  it('renders assignment rows when API has items', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/users/:userId/assignments', () =>
        HttpResponse.json({
          items: [
            {
              id: 'asgn-1',
              userId: USER_ID,
              storeId: 'store-prado-seed',
              role: 'vendedora',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );

    renderWithProviders(<AssignmentsManager userId={USER_ID} isUserAdmin={false} />);

    // Wait for the assignment row to appear — the row shows a "Quitar" button with aria-label
    await screen.findByRole('button', { name: /quitar sucursal prado/i });
    expect(screen.getByRole('combobox', { name: /rol para sucursal prado/i })).toHaveValue('vendedora');
  });

  it('adding a new assignment calls POST and the list shows add form', async () => {
    let postCalled = false;
    server.use(
      http.post('http://localhost:3000/api/v1/users/:userId/assignments', () => {
        postCalled = true;
        return HttpResponse.json(
          {
            id: 'asgn-new',
            userId: USER_ID,
            storeId: 'store-prado-seed',
            role: 'vendedora',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<AssignmentsManager userId={USER_ID} isUserAdmin={false} />);

    // Wait for the add form to be rendered
    const addButton = await screen.findByRole('button', { name: /agregar/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });

  it('changing role on a row calls PATCH', async () => {
    let patchCalled = false;
    server.use(
      http.get('http://localhost:3000/api/v1/users/:userId/assignments', () =>
        HttpResponse.json({
          items: [
            {
              id: 'asgn-1',
              userId: USER_ID,
              storeId: 'store-prado-seed',
              role: 'vendedora',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      http.patch('http://localhost:3000/api/v1/users/:userId/assignments/:id', () => {
        patchCalled = true;
        return HttpResponse.json({
          id: 'asgn-1',
          userId: USER_ID,
          storeId: 'store-prado-seed',
          role: 'encargada',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<AssignmentsManager userId={USER_ID} isUserAdmin={false} />);

    const roleSelect = await screen.findByRole('combobox', { name: /rol para sucursal prado/i });
    await user.selectOptions(roleSelect, 'encargada');

    await waitFor(() => {
      expect(patchCalled).toBe(true);
    });
  });

  it('removing the last assignment triggers confirm UI, then DELETE with ?confirm=true', async () => {
    let deleteUrl = '';
    server.use(
      http.get('http://localhost:3000/api/v1/users/:userId/assignments', () =>
        HttpResponse.json({
          items: [
            {
              id: 'asgn-1',
              userId: USER_ID,
              storeId: 'store-prado-seed',
              role: 'vendedora',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      http.delete('http://localhost:3000/api/v1/users/:userId/assignments/:id', ({ request }) => {
        deleteUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<AssignmentsManager userId={USER_ID} isUserAdmin={false} />);

    const quitarBtn = await screen.findByRole('button', { name: /quitar sucursal prado/i });
    await user.click(quitarBtn);

    // Confirm UI should appear
    const confirmBtn = await screen.findByRole('button', { name: /confirmar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(deleteUrl).toContain('confirm=true');
    });
  });

  it('shows admin message when isUserAdmin is true', () => {
    renderWithProviders(<AssignmentsManager userId={USER_ID} isUserAdmin={true} />);
    expect(screen.getByText(/los admins globales no tienen asignaciones/i)).toBeInTheDocument();
  });
});
