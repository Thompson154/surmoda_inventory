import { type ReactNode } from 'react';
import { cn } from './cn';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, { badge: string; dot: string }> = {
  default: {
    badge: 'bg-surface-sunken/80 text-text-secondary border border-surface-border/60',
    dot: 'bg-text-muted',
  },
  success: {
    badge: 'bg-status-success-soft/70 text-status-success border border-status-success/30',
    dot: 'bg-status-success animate-pulse',
  },
  warning: {
    badge: 'bg-status-warning-soft/70 text-status-warning border border-status-warning/30',
    dot: 'bg-status-warning animate-pulse',
  },
  danger: {
    badge: 'bg-status-danger-soft/70 text-status-danger border border-status-danger/30',
    dot: 'bg-status-danger animate-pulse',
  },
  info: {
    badge: 'bg-status-info-soft/70 text-status-info border border-status-info/30',
    dot: 'bg-status-info',
  },
};

export function Badge({
  variant = 'default',
  dot = false,
  children,
  className,
}: BadgeProps): JSX.Element {
  const current = variantClasses[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-xs transition-colors',
        current.badge,
        className,
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', current.dot)} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

/** High-contrast badge highlighting the original model code entered at intake. */
export function ProductCodeBadge({
  code,
  className,
}: {
  code: string;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-bold tracking-wide bg-indigo-500/12 text-indigo-700 border border-indigo-500/30 dark:bg-[#e3ff6a]/15 dark:text-[#e3ff6a] dark:border-[#e3ff6a]/35',
        className,
      )}
    >
      {code}
    </span>
  );
}
