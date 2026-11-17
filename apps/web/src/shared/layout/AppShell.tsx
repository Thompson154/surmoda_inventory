import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { BottomNav, type BottomNavTab } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { InstallPwaPrompt } from './InstallPwaPrompt';
import { PwaUpdateBanner } from './PwaUpdateBanner';

interface AppShellProps {
  children: ReactNode;
  /** Context label to render in the header (typically the active store name). */
  context?: string;
  /** When provided, renders a fixed BottomNav with these tabs and adds bottom padding. */
  bottomNav?: BottomNavTab[];
}

export function AppShell({ children, context, bottomNav }: AppShellProps) {
  return (
    <div className="relative min-h-[100dvh] bg-surface-base flex flex-col overflow-x-hidden selection:bg-brand-primary/20 selection:text-brand-primary">
      {/* Ambient background glows for macOS-style atmospheric depth */}
      <div
        className="fixed -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-brand-primary/8 dark:bg-brand-primary/18 blur-[140px] pointer-events-none rounded-full"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/2 -right-40 w-[500px] h-[350px] bg-status-info/5 dark:bg-status-info/12 blur-[130px] pointer-events-none rounded-full"
        aria-hidden="true"
      />

      <PwaUpdateBanner />
      <OfflineBanner />
      <InstallPwaPrompt />
      <AppHeader context={context} />
      <div className={bottomNav ? 'flex-1 pb-20 relative' : 'flex-1 relative'}>{children}</div>
      {bottomNav && <BottomNav tabs={bottomNav} />}
    </div>
  );
}
