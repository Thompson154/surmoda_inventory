import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

  const content = (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4',
        'bg-slate-950/65 backdrop-blur-sm animate-fade-in',
      )}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 bg-surface-raised supports-[backdrop-filter]:bg-glass-elevated backdrop-blur-md',
          'border border-glass-border shadow-2xl',
          'w-full max-w-md',
          'max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:animate-sheet-up max-sm:max-h-[90dvh] max-sm:overflow-y-auto',
          'max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
          'sm:rounded-2xl sm:animate-scale-in',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle indicator */}
        <div
          className="sm:hidden mx-auto mt-3 h-1.5 w-12 rounded-full bg-text-subtle/30"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-3 pb-3 sm:pt-5 sm:pb-4 border-b border-surface-border">
          <h2 id={titleId} className="text-base sm:text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Cerrar"
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center',
              'text-text-subtle hover:text-text-secondary hover:bg-surface-sunken active:scale-95',
              'transition-all duration-150',
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

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
