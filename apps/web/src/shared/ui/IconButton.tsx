import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: 'ghost' | 'secondary';
  size?: 'sm' | 'md';
}

// Solid disabled colors (not opacity) so contrast stays WCAG 2.1 AA.
const variantClasses: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost:
    'text-text-secondary hover:bg-surface-sunken ' +
    'disabled:text-text-subtle disabled:cursor-not-allowed',
  secondary:
    'border border-surface-border-strong text-text-secondary bg-surface-raised hover:bg-surface-sunken ' +
    'disabled:bg-surface-base disabled:text-text-subtle disabled:border-surface-border disabled:cursor-not-allowed',
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
