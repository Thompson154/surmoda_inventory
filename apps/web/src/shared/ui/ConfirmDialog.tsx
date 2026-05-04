import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from './cn';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  // WHY: reason arg only present when requiresReason=true
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isPending?: boolean;
  requiresReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonMinLength?: number;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  isPending = false,
  requiresReason = false,
  reasonLabel = 'Motivo',
  reasonPlaceholder = 'Explicá brevemente el motivo',
  reasonMinLength = 1,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [localPending, setLocalPending] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descId = 'confirm-dialog-desc';

  // WHY: reset reason text each time the dialog opens fresh
  useEffect(() => {
    if (open) {
      setReason('');
      setLocalPending(false);
    }
  }, [open]);

  // WHY: override Modal's close-button focus to put focus on the confirm action
  useEffect(() => {
    if (!open) return;
    const target = requiresReason ? textareaRef.current : confirmRef.current;
    // Small timeout lets Modal's own focus effect run first
    const id = setTimeout(() => target?.focus(), 0);
    return () => clearTimeout(id);
  }, [open, requiresReason]);

  const isReasonValid = !requiresReason || reason.trim().length >= reasonMinLength;
  const pending = isPending || localPending;
  const confirmDisabled = pending || !isReasonValid;

  async function handleConfirm() {
    if (confirmDisabled) return;
    const result = onConfirm(requiresReason ? reason : undefined);
    if (result instanceof Promise) {
      setLocalPending(true);
      try {
        await result;
      } finally {
        setLocalPending(false);
      }
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleConfirm();
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={title} role="alertdialog">
      <div className="flex flex-col gap-4">
        {description && (
          <p id={descId} className="text-sm text-text-secondary">
            {description}
          </p>
        )}

        {requiresReason && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm-dialog-reason"
              className="text-sm font-medium text-text-secondary"
            >
              {reasonLabel}
            </label>
            <textarea
              id="confirm-dialog-reason"
              ref={textareaRef}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={reasonPlaceholder}
              disabled={pending}
              aria-label={reasonLabel}
              className={cn(
                'w-full resize-none rounded-md border border-surface-border bg-surface-base',
                'px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <button
            ref={confirmRef}
            onClick={handleConfirm}
            disabled={confirmDisabled}
            data-variant={variant}
            className={cn(
              'inline-flex items-center justify-center gap-2 font-medium',
              'h-10 px-4 text-sm rounded-md',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
              variant === 'danger'
                ? 'bg-status-danger text-white hover:opacity-90 disabled:bg-status-danger-soft disabled:text-status-danger disabled:cursor-not-allowed'
                : 'bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-active disabled:bg-surface-sunken disabled:text-text-muted disabled:cursor-not-allowed',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
