import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  ariaLabelledBy?: string;
  // WHY: alertdialog role needed for destructive confirm dialogs (ARIA spec)
  role?: 'dialog' | 'alertdialog';
}

// All elements that the browser considers tabbable. Used by the focus trap
// below. Elements with a negative tabindex or that are disabled / hidden are
// excluded.
const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getTabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  ariaLabelledBy,
  role = 'dialog',
}: ModalProps) {
  const titleId = ariaLabelledBy ?? 'modal-title';
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Saves whatever was focused before the modal opened so we can restore on close.
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Focus management on open / close. Runs ONLY on the boolean transition so
  // updates to onClose don't steal focus mid-typing.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      // The close button is a stable, always-present anchor. Inner pages can
      // re-focus a more natural target after mount if they want.
      closeButtonRef.current?.focus();
      return;
    }
    // Modal closed — restore focus to whatever opened it (Save/Edit button etc.)
    const prev = previouslyFocusedRef.current;
    if (prev instanceof HTMLElement) prev.focus();
  }, [isOpen]);

  // Keyboard contract: Escape closes; Tab cycles within the dialog. The cycle
  // is what makes screen-reader / keyboard users not lose context to the page
  // behind the dialog.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const tabbables = getTabbables(dialogRef.current);
      if (tabbables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = tabbables[0]!;
      const last = tabbables[tabbables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-slate-900/60 backdrop-blur-sm animate-fade-in',
      )}
      // Backdrop click closes the modal. Keyboard equivalent is Escape, which
      // is wired in the effect above — the static-element jsx-a11y warning is
      // a known acceptable pattern for modal scrims.

      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 bg-surface-raised supports-[backdrop-filter]:bg-glass-elevated backdrop-blur-md border border-glass-border rounded-xl shadow-2xl animate-scale-in',
          'max-w-md w-full mx-4',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-border">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Cerrar"
            className={cn(
              'h-8 w-8 rounded-md flex items-center justify-center',
              'text-text-subtle hover:text-text-secondary hover:bg-surface-sunken',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
