// Tier 3.A.2 — offline queue drain hook.
//
// Mounted once in Providers (next to ToastProvider). On every 'online'
// browser event AND on app start, walks the localStorage queue and POSTs
// each entry to /api/v1/stores/:storeId/sales. Successful drains remove
// the entry; transient failures bump the attempts counter; entries that
// hit MAX_ATTEMPTS get dropped (with a console.warn) so a permanently-bad
// payload doesn't loop forever.
//
// The hook is intentionally Provider-level (not per-page) so the drain
// runs even if the cashier is currently looking at the inventory tab when
// wifi comes back.

import { useEffect } from 'react';
import type { SaleWithItems } from '@surmoda/contracts';
import { httpClient } from '@/shared/services/httpClient';
import {
  listPending,
  recordFailedAttempt,
  removePending,
  type OfflineSaleEntry,
} from '@/shared/services/offlineQueue';

async function drainOne(entry: OfflineSaleEntry): Promise<'success' | 'transient' | 'permanent'> {
  try {
    await httpClient.post<SaleWithItems>(`/stores/${entry.storeId}/sales`, entry.body);
    return 'success';
  } catch (err) {
    // 4xx (validation, FORBIDDEN, etc.) won't change on retry → drop.
    // 5xx + network errors are transient → keep + bump attempts.
    const e = err as { status?: number };
    if (e.status && e.status >= 400 && e.status < 500) return 'permanent';
    return 'transient';
  }
}

async function drainQueue(): Promise<void> {
  const entries = listPending();
  if (entries.length === 0) return;
  for (const entry of entries) {
    const outcome = await drainOne(entry);
    if (outcome === 'success' || outcome === 'permanent') {
      removePending(entry.id);
      if (outcome === 'permanent') {
        console.warn(
          '[offlineQueue] sale dropped after permanent (4xx) error',
          entry.id,
          entry.storeId,
        );
      }
    } else {
      const { dropped } = recordFailedAttempt(entry.id);
      if (dropped) {
        console.warn(
          '[offlineQueue] sale dropped after MAX_ATTEMPTS transient failures',
          entry.id,
          entry.storeId,
        );
      }
      // Stop the drain on the first transient failure — the network is
      // still flaky; the next 'online' event will retry.
      break;
    }
  }
}

export function useOfflineSaleSync(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = (): void => {
      void drainQueue();
    };
    window.addEventListener('online', onOnline);
    // Drain once on mount in case the user reopened the app while online
    // with leftover queue entries.
    void drainQueue();
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, []);
}
