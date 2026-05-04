import { type ReactNode } from 'react';
import { cn } from './cn';

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, error, hint, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-secondary">
        {label}
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
