import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error = false, fullWidth = true, className, ...rest },
  ref,
) {
  return (
    <div className={cn('relative', fullWidth ? 'w-full' : 'inline-block')}>
      <select
        ref={ref}
        className={cn(
          'h-10 px-3 pr-8 text-sm rounded-md appearance-none',
          'bg-surface-raised border text-text-primary',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2',
          'disabled:bg-surface-sunken disabled:cursor-not-allowed',
          error
            ? 'border-status-danger focus:border-status-danger focus:ring-status-danger/20'
            : 'border-surface-border-strong focus:border-brand-primary focus:ring-brand-primary/20',
          fullWidth ? 'w-full' : '',
          className,
        )}
        {...rest}
      />
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-subtle"
        aria-hidden="true"
      />
    </div>
  );
});
