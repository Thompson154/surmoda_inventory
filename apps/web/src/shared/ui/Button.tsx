import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// Disabled-state palette uses SOLID colors (not opacity-50) so the contrast
// against the background still satisfies WCAG 2.1 AA — opacity dilutes the
// foreground/background ratio in a way the spec measures unfavourably.
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-active ' +
    'disabled:bg-surface-sunken disabled:text-text-muted disabled:cursor-not-allowed',
  secondary:
    'border border-surface-border-strong text-text-secondary bg-surface-raised hover:bg-surface-sunken ' +
    'disabled:bg-surface-base disabled:text-text-subtle disabled:border-surface-border disabled:cursor-not-allowed',
  danger:
    'bg-status-danger text-white hover:bg-status-danger ' +
    'disabled:bg-status-danger-soft disabled:text-status-danger disabled:cursor-not-allowed',
  ghost:
    'text-text-secondary hover:bg-surface-sunken ' +
    'disabled:text-text-subtle disabled:cursor-not-allowed',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-6 text-base rounded-md',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled ?? isLoading;

  return (
    <button
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
