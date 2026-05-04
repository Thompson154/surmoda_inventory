import { AvatarMenu } from './AvatarMenu';
import { BellMenu } from '@/features/alerts/components/BellMenu';

interface AppHeaderProps {
  /** Optional context label appended after "Sur Moda" — typically the active store name. */
  context?: string;
}

export function AppHeader({ context }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-surface-raised/85 backdrop-blur border-b border-surface-border">
      <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate">
            Sur Moda{context ? ` · ${context}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <BellMenu />
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
}
