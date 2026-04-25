import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps): JSX.Element {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md',
        'bg-gradient-to-r from-surface-sunken via-surface-base to-surface-sunken',
        'bg-[length:1000px_100%]',
        className,
      )}
    />
  );
}
