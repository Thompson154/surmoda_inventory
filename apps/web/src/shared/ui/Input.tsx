import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, fullWidth = true, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 px-3 text-sm rounded-md',
        'bg-white border text-slate-900 placeholder:text-slate-400',
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
  );
});
