import { type ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className,
      )}
    >
      {icon && (
        <div className="h-12 w-12 rounded-full bg-surface-sunken flex items-center justify-center text-slate-400 mb-4">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 mt-1.5 max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  );
}
