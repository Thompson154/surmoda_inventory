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
// WCAG 2.1 AA compliant disabled state colors
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-primary text-white shadow-xs hover:bg-brand-primary-hover active:bg-brand-primary-active ' +
    'border border-black/10 dark:border-white/10 ' +
    'disabled:bg-surface-sunken disabled:text-text-muted disabled:border-transparent disabled:cursor-not-allowed',
  secondary:
    'border border-surface-border-strong text-text-secondary bg-surface-raised shadow-xs hover:bg-surface-sunken active:bg-surface-sunken/80 ' +
    'disabled:bg-surface-base disabled:text-text-subtle disabled:border-surface-border disabled:cursor-not-allowed',
  danger:
    'bg-status-danger text-white shadow-xs hover:bg-status-danger/90 active:bg-status-danger ' +
    'border border-black/10 dark:border-white/10 ' +
    'disabled:bg-status-danger-soft disabled:text-status-danger disabled:cursor-not-allowed',
  ghost:
    'text-text-secondary hover:bg-surface-sunken active:bg-surface-sunken/80 ' +
    'disabled:text-text-subtle disabled:cursor-not-allowed',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3.5 text-xs rounded-xl',
  md: 'h-10 px-4.5 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-2xl',
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
        'inline-flex items-center justify-center gap-2 font-medium select-none',
        'transition-all duration-150 active:scale-[0.97] disabled:active:scale-100 ease-out',
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
