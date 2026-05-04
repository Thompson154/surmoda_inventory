import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Tier 3.B.13 — service-worker update banner.
//
// `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`. The
// SW updates silently in the background but the user staying on the page
// keeps the OLD bundle until they reload manually. If the deploy was a
// critical bug fix, they don't get it. This banner closes that gap:
//   1. Listen for `controllerchange` (SW takes over) AND poll for a
//      waiting SW registration.
//   2. Show a non-blocking "Nueva versión disponible — actualizar" banner.
//   3. Tapping "Actualizar" calls `window.location.reload()` so the new
//      SW activates and takes over the page.
//
// We deliberately avoid the `virtual:pwa-register/react` ESM import path
// because it adds a build-time dependency the vitest runner doesn't always
// resolve. The plain controllerchange + waiting-SW polling is enough.

export function PwaUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onControllerChange = (): void => {
      // A new SW just took over. The old page still references the old
      // bundle — surface the prompt so the user reloads voluntarily.
      setUpdateReady(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Fallback: poll for a waiting registration. Vite-plugin-pwa promotes
    // a waiting SW to active automatically (skipWaiting), but on slower
    // mobile networks the controllerchange can fire after the user has
    // moved on — checking the registration state explicitly catches that.
    let cancelled = false;
    const checkWaiting = async (): Promise<void> => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!cancelled && reg?.waiting) setUpdateReady(true);
      } catch {
        // Registration not available yet — try again on next poll.
      }
    };
    const handle = window.setInterval(() => void checkWaiting(), 60_000);
    void checkWaiting();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.clearInterval(handle);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="region"
      aria-label="Nueva versión disponible"
      className="bg-indigo-600 text-white px-3 py-2 flex items-center gap-2"
    >
      <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="text-xs flex-1">
        <span className="font-semibold">Nueva versión disponible.</span> Actualizá para aplicar
        mejoras y correcciones.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-surface-raised text-indigo-700 text-xs font-semibold px-3 py-1 hover:bg-indigo-50"
      >
        Actualizar
      </button>
    </div>
  );
}
