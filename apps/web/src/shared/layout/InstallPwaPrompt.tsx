import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Catches the `beforeinstallprompt` event Chrome / Edge fire when the PWA
 * meets the install criteria, then shows a slim CTA so staff add the app to
 * their home screen. The install dialog is OS-level — we just hand the
 * deferred event back when the user taps the button.
 *
 * Behaviour notes:
 *   - The event fires once per session. If the user dismisses our CTA we
 *     remember it in localStorage so we don't nag them.
 *   - Safari iOS does NOT fire `beforeinstallprompt` (Apple's PWA install
 *     flow is via Share → Add to Home Screen). We render NOTHING on iOS so
 *     the banner doesn't lie.
 *   - The "appinstalled" event clears state so future visits don't show
 *     the prompt again.
 */
type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
};

// Tier 3.C.10 — store an ISO timestamp instead of a boolean. Each dismiss
// silences the prompt for 7 days; after that it shows again. Catches the
// case where staff dismiss during onboarding then never see the option to
// install (the original "forever-dismissed" model was too aggressive for
// a B2B tool where install genuinely benefits users every day).
const DISMISS_KEY = 'surmoda:pwa-install-dismissed-until';
const SNOOZE_DAYS = 7;

function readDismissUntil(): number {
  if (typeof window === 'undefined') return Number.MAX_SAFE_INTEGER;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return 0;
  // Legacy: '1' means dismissed-forever from the Tier 1 implementation.
  // Treat as a 7-day snooze starting now so we don't permanently lock
  // out users who upgraded the bundle.
  if (raw === '1') {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    return until;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InstallPwaPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => readDismissUntil());

  useEffect(() => {
    function onBeforeInstall(e: Event): void {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled(): void {
      setDeferred(null);
      // Hard-stop: an already-installed app should never see the prompt.
      // Use the year-3000 sentinel so the SNOOZE_DAYS check treats it as
      // permanently dismissed.
      const forever = new Date('3000-01-01T00:00:00Z').getTime();
      setDismissedUntil(forever);
      window.localStorage.setItem(DISMISS_KEY, String(forever));
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Reading Date.now() in render is technically impure per react-hooks/purity,
  // but the visibility flag genuinely depends on wall-clock time relative to
  // the user-set snooze. The component naturally re-renders when state changes
  // (deferred/dismissedUntil), and a stale read here just means the banner
  // shows up to one render late — which is the desired behaviour anyway.
  // eslint-disable-next-line react-hooks/purity
  if (!deferred || Date.now() < dismissedUntil) return null;

  const dismiss = (): void => {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    setDismissedUntil(until);
    window.localStorage.setItem(DISMISS_KEY, String(until));
  };

  const install = async (): Promise<void> => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'dismissed') {
      // User said no via the OS dialog; honor their choice this session.
      dismiss();
    }
    setDeferred(null);
  };

  return (
    <div
      role="region"
      aria-label="Instalar aplicación"
      className="bg-brand-primary-soft border-b border-indigo-200 px-3 py-2 flex items-center gap-2"
    >
      <Download className="h-4 w-4 text-brand-primary shrink-0" />
      <p className="text-xs flex-1 text-text-secondary">
        <span className="font-semibold">Instalá Sur Moda</span> en tu pantalla de inicio para acceso
        rápido sin abrir el navegador.
      </p>
      <button
        type="button"
        onClick={() => void install()}
        className="rounded-md bg-brand-primary text-white text-xs font-semibold px-3 py-1 hover:bg-brand-primary-hover"
      >
        Instalar
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar"
        className="rounded-md p-1 text-text-muted hover:text-text-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
