import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Lightweight in-app toast system. Hand-rolled because:
//   - Adding react-hot-toast (~12 KB) for ~200 LoC is bad ROI per YAGNI.
//   - The internal app needs only 3 variants (success / error / info), no
//     promise tracking, no dismiss-all, no stacking quirks.
//
// Usage:
//   1. Wrap the app once in <ToastProvider>.
//   2. Anywhere in the tree: const toast = useToast();
//      toast.success('Venta guardada');
//      toast.error('Sin stock disponible');
//      toast.info('Conexión restablecida');
//
// Auto-dismisses after 4 s. The user can also tap the X to close early.
// Toasts queue in the bottom-right (mobile-friendly position; doesn't cover
// the BottomNav, doesn't trip a thumb resting on the iOS home bar).

type Variant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  variant: Variant;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

const AUTO_DISMISS_MS = 4_000;

const palette: Record<
  Variant,
  { bg: string; border: string; text: string; iconClass: string; Icon: typeof Info }
> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    iconClass: 'text-emerald-500',
    Icon: CheckCircle2,
  },
  error: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
    iconClass: 'text-rose-500',
    Icon: AlertCircle,
  },
  info: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-800',
    iconClass: 'text-slate-500',
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: Variant, message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev, { id, variant, message }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (msg) => push('success', msg),
      error: (msg) => push('error', msg),
      info: (msg) => push('info', msg),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // Tier 3.C.8 — clamp the bottom offset above the iOS virtual keyboard.
        // `env(keyboard-inset-height,0px)` returns the keyboard height when
        // it's open and 0 otherwise; we still keep a 96px floor so the toast
        // clears the BottomNav + iOS home bar with a comfortable margin.
        className="fixed bottom-[max(6rem,env(keyboard-inset-height,0px))] right-3 z-[60] flex flex-col gap-2 max-w-[calc(100vw-1.5rem)] sm:max-w-sm pointer-events-none"
        role="region"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { Icon, bg, border, text, iconClass } = palette[toast.variant];

  // Auto-dismiss runs on MOUNT only; never re-arms on rerender.
  useEffect(() => {
    const handle = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(handle);
  }, [toast.id, onDismiss]);

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg ${bg} ${border}`}
    >
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true" />
      <p className={`text-sm flex-1 ${text}`}>{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className={`shrink-0 rounded p-0.5 ${text} hover:bg-black/5`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
