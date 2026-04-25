import { type ReactNode } from 'react';

export interface AlertProps {
  variant?: 'error' | 'warning' | 'info' | 'success';
  children: ReactNode;
}

const variantClasses: Record<NonNullable<AlertProps['variant']>, string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-slate-50 text-slate-700 border-slate-200',
  success: 'bg-green-50 text-green-800 border-green-200',
};

export function Alert({ variant = 'error', children }: AlertProps) {
  return (
    <div role="alert" className={`rounded border px-3 py-2 text-sm ${variantClasses[variant]}`}>
      {children}
    </div>
  );
}
