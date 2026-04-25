import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { StoresListPage } from '../StoresListPage';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

describe('StoresListPage', () => {
  it('renders the seeded stores from the MSW handler with kind badges', async () => {
    renderWithProviders(<StoresListPage />);

    expect(await screen.findByText('Sucursal Prado')).toBeInTheDocument();
    expect(screen.getByText('Almacén Central')).toBeInTheDocument();
    expect(screen.getAllByText(/sucursal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/almacén/i).length).toBeGreaterThan(0);
  });

  it('shows the empty state when the API returns no items', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/stores', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    );

    renderWithProviders(<StoresListPage />);

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });
});
