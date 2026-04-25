import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

export function renderWithProviders(
  ui: ReactElement,
  options: { initialEntries?: string[]; client?: QueryClient } = {},
) {
  const client = options.client ?? makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
