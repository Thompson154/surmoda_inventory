import { AvatarMenu } from './AvatarMenu';
import { BellMenu } from '@/features/alerts/components/BellMenu';

interface AppHeaderProps {
  /** Optional context label appended after "Sur Moda" — typically the active store name. */
  context?: string;
}

export function AppHeader({ context }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-surface-raised/85 supports-[backdrop-filter]:bg-glass-nav backdrop-blur-md border-b border-surface-border/80 shadow-2xs">
      <div className="mx-auto max-w-4xl px-4 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-brand-primary flex items-center justify-center text-white font-bold text-xs shadow-xs tracking-tight shrink-0">
            SM
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold tracking-tight text-text-primary shrink-0">
              Sur Moda
            </span>
            {context && (
              <>
                <span className="text-text-subtle text-xs">/</span>
                <span className="text-xs font-medium text-text-secondary truncate bg-surface-sunken/80 px-2 py-0.5 rounded-md border border-surface-border/60">
                  {context}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <BellMenu />
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
}
