import { type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundaryWithReset } from '@/shared/components/ErrorBoundary';
import { ToastProvider } from '@/shared/ui';
import { useOfflineSaleSync } from '@/features/sales/hooks/useOfflineSaleSync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

/** Internal child so the offline-sync hook (which depends on the QueryClient
 *  and BrowserRouter being mounted) can run inside the provider tree. */
function ProvidersInner({ children }: { children: ReactNode }) {
  // Tier 3.A.2 — drain pending offline sales every time the browser fires
  // 'online' (and once on mount). Mounted Provider-level so it runs even
  // when the user is on a different tab when wifi returns.
  useOfflineSaleSync();
  // ErrorBoundaryWithReset resets on every route change (via location.key).
  // Placed here — inside BrowserRouter — so useLocation() is available.
  return <ErrorBoundaryWithReset>{children}</ErrorBoundaryWithReset>;
}

export function Providers({ children }: { children: ReactNode }) {
  // QueryClientProvider and ToastProvider wrap the BrowserRouter so they are
  // available to hooks like useOfflineSaleSync inside ProvidersInner.
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <ProvidersInner>{children}</ProvidersInner>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
