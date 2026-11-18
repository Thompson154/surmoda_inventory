import { type ReactNode } from 'react';
import { cn } from './cn';

export interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, required, error, hint, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-secondary">
        {label}
        {required && (
          <span aria-hidden="true" className="text-status-danger ml-0.5 font-semibold">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-muted mt-1">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-status-danger mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}

export function RequiredNote({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-text-muted', className)}>
      <span aria-hidden="true" className="text-status-danger font-semibold">
        *
      </span>{' '}
      Campos obligatorios
    </p>
  );
}
