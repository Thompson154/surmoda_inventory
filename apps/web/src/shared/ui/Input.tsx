import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, fullWidth = true, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={[
        'rounded border px-3 py-2 text-base focus:outline-none',
        error
          ? 'border-red-500 focus:border-red-600'
          : 'border-slate-300 focus:border-slate-700',
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});
