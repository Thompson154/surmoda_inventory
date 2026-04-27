import { type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
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
  return <BrowserRouter>{children}</BrowserRouter>;
}

export function Providers({ children }: { children: ReactNode }) {
  // ErrorBoundary wraps EVERYTHING so a render bug in any provider, route, or
  // component falls back to the recoverable shell instead of a white screen.
  // Once the APM is wired (Tier 1), the onError callback will pipe to it.
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ProvidersInner>{children}</ProvidersInner>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
