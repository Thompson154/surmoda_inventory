import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: 'ghost' | 'secondary';
  size?: 'sm' | 'md';
}

const variantClasses: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost:
    'text-slate-700 hover:bg-surface-sunken ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'border border-surface-border-strong text-slate-700 bg-white hover:bg-surface-sunken ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
};

const sizeClasses: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: IconButtonProps): JSX.Element {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
