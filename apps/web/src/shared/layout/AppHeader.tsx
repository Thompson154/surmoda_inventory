import { NavLink } from 'react-router-dom';
import { Boxes, ScanLine, ShoppingCart, Truck } from 'lucide-react';
import { AvatarMenu } from './AvatarMenu';
import type { BottomNavTab } from './BottomNav';
import { BellMenu } from '@/features/alerts/components/BellMenu';
import { cn } from '@/shared/ui/cn';

const ICON_MAP = {
  inventario: Boxes,
  entregas: Truck,
  ventas: ShoppingCart,
  scanner: ScanLine,
};

interface AppHeaderProps {
  /** Optional context label appended after "Sur Moda" — typically the active store name. */
  context?: string;
  /** Navigation tabs rendered inline on desktop (md+) and in BottomNav on mobile. */
  navTabs?: BottomNavTab[];
}

export function AppHeader({ context, navTabs }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-glass-nav backdrop-blur-xl border-b border-surface-border">
      <div className="mx-auto max-w-5xl px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-full bg-text-primary text-text-inverse flex items-center justify-center font-display font-bold text-xs tracking-tight shrink-0 shadow-xs">
            SM
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-base font-bold tracking-tight text-text-primary shrink-0">
              Sur Moda
            </span>
            {context && (
              <>
                <span className="text-text-subtle text-xs select-none">/</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium text-text-primary bg-surface-raised border border-surface-border truncate shadow-2xs">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-status-success shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{context}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Desktop inline segmented navigation (replaces floating mobile bottom bar on md+) */}
        {navTabs && navTabs.length > 0 && (
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-1 bg-surface-raised border border-surface-border rounded-full p-1 shadow-2xs"
          >
            {navTabs.map((tab) => {
              const Icon = ICON_MAP[tab.icon];
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-sunken/70',
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <BellMenu />
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
}
