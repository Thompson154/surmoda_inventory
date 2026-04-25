import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error = false, fullWidth = true, className = '', ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={[
        'rounded border px-3 py-2 text-base focus:outline-none bg-white',
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
