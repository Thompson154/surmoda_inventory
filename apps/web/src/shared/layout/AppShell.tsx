import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { BottomNav, type BottomNavTab } from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  /** Context label to render in the header (typically the active store name). */
  context?: string;
  /** When provided, renders a fixed BottomNav with these tabs and adds bottom padding. */
  bottomNav?: BottomNavTab[];
}

export function AppShell({ children, context, bottomNav }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <AppHeader context={context} />
      <div className={bottomNav ? 'flex-1 pb-20' : 'flex-1'}>{children}</div>
      {bottomNav && <BottomNav tabs={bottomNav} />}
    </div>
  );
}
