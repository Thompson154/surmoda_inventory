import { type ReactNode } from 'react';
import { cn } from './cn';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-surface-sunken text-slate-700',
  success: 'bg-status-success-soft text-emerald-700',
  warning: 'bg-status-warning-soft text-amber-700',
  danger:  'bg-status-danger-soft text-red-700',
  info:    'bg-status-info-soft text-sky-700',
};

export function Badge({ variant = 'default', children, className }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
