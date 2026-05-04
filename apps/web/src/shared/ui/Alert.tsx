import { type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from './cn';

export interface AlertProps {
  variant?: 'error' | 'warning' | 'info' | 'success';
  children: ReactNode;
  className?: string;
}

const variantConfig: Record<
  NonNullable<AlertProps['variant']>,
  { icon: typeof AlertCircle; classes: string }
> = {
  error: {
    icon: AlertCircle,
    classes: 'bg-status-danger-soft border-status-danger/20 text-status-danger',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-status-warning-soft border-status-warning/30 text-status-warning',
  },
  info: {
    icon: Info,
    classes: 'bg-status-info-soft border-status-info/20 text-sky-800',
  },
  success: {
    icon: CheckCircle2,
    classes: 'bg-status-success-soft border-status-success/20 text-status-success',
  },
};

export function Alert({ variant = 'error', children, className }: AlertProps) {
  const { icon: Icon, classes } = variantConfig[variant];

  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border px-3 py-2.5 text-sm flex items-start gap-2',
        classes,
        className,
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
