import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundaryWithReset } from '@/shared/components/ErrorBoundary';
import { Skeleton, ToastProvider } from '@/shared/ui';
import { useOfflineSaleSync } from '@/features/sales/hooks/useOfflineSaleSync';
import { authService } from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

// Module-level singleton ensures React StrictMode double-mount does not issue
// two concurrent /auth/refresh calls (which would trigger refresh-token replay).
let bootPromise: Promise<void> | null = null;
let bootSettled = false;

function ensureSessionBootstrapped(): Promise<void> {
  if (useAuthStore.getState().user) {
    bootSettled = true;
    return Promise.resolve();
  }
  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        const { accessToken } = await authService.refresh();
        useAuthStore.getState().setAccessToken(accessToken);
        const user = await authService.me();
        useAuthStore.getState().setAuth({ accessToken, user });
      } catch {
        useAuthStore.getState().clearAuth();
      } finally {
        bootSettled = true;
      }
    })();
  }
  return bootPromise;
}

/** Internal child so the offline-sync hook (which depends on the QueryClient
 *  and BrowserRouter being mounted) can run inside the provider tree. */
function ProvidersInner({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => bootSettled || Boolean(useAuthStore.getState().user));

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    void ensureSessionBootstrapped().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // Tier 3.A.2 — drain pending offline sales every time the browser fires
  // 'online' (and once on mount). Placed here so router + query context exist.
  useOfflineSaleSync();

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-3 p-4">
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </main>
    );
  }

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
