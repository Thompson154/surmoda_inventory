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
    <div className="min-h-[100dvh] bg-surface-base flex flex-col">
      {/* OfflineBanner + InstallPwaPrompt + PwaUpdateBanner are silent until
          they fire; each renders NULL otherwise, so the layout is unchanged
          on the happy path. */}
      <PwaUpdateBanner />
      <OfflineBanner />
      <InstallPwaPrompt />
      <AppHeader context={context} />
      <div className={bottomNav ? 'flex-1 pb-20' : 'flex-1'}>{children}</div>
      {bottomNav && <BottomNav tabs={bottomNav} />}
    </div>
  );
}
