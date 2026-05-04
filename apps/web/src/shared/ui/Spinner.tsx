import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function Spinner({ size = 'md', className }: SpinnerProps): JSX.Element {
  return (
    <Loader2
      className={cn('animate-spin text-text-subtle', sizeClasses[size], className)}
      aria-hidden="true"
    />
  );
}
