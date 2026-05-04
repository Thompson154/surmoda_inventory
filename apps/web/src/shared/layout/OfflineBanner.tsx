import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Slim banner that surfaces network loss to staff. The shop wifi is flaky;
 * without this, a vendedora hitting "Cobrar" sees a hanging spinner with no
 * idea whether the sale was recorded. The banner is purely informational —
 * it does not block UI; the cashier modal will still attempt the request and
 * the API client surfaces the failure separately.
 *
 * Source of truth is the browser's `online` / `offline` events plus the
 * initial `navigator.onLine` snapshot. We do NOT poll the API; that would
 * waste battery and bandwidth without giving us better signal than the OS.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const onOnline = (): void => setIsOnline(true);
    const onOffline = (): void => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-status-warning-soft text-status-warning border-b border-status-warning px-3 py-1.5 text-xs flex items-center justify-center gap-2"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">Sin conexión</span>
      <span className="text-status-warning">— las acciones quedarán pendientes</span>
    </div>
  );
}
