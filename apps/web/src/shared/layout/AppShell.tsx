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
    <div className="relative min-h-[100dvh] bg-soft-mesh flex flex-col overflow-x-hidden">
      <PwaUpdateBanner />
      <OfflineBanner />
      <InstallPwaPrompt />
      <AppHeader context={context} navTabs={bottomNav} />
      <div className={bottomNav ? 'flex-1 pb-24 md:pb-8 relative' : 'flex-1 relative'}>
        {children}
      </div>
      {bottomNav && <BottomNav tabs={bottomNav} />}
    </div>
  );
}
