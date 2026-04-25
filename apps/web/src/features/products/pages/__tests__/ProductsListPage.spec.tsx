import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { ProductsListPage } from '../ProductsListPage';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

describe('ProductsListPage', () => {
  it('renders products from the MSW handler with code and variant count', async () => {
    renderWithProviders(<ProductsListPage />);

    expect(await screen.findByText('Jean Bota Recta')).toBeInTheDocument();
    expect(screen.getByText('Chaqueta clásica')).toBeInTheDocument();
    expect(screen.getByText('JN001')).toBeInTheDocument();
    expect(screen.getByText('3 variantes')).toBeInTheDocument();
  });

  it('shows the empty state when the API returns no products', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/products', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    );

    renderWithProviders(<ProductsListPage />);

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });
});
