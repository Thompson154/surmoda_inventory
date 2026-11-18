import { NavLink } from 'react-router-dom';
import { Boxes, ScanLine, ShoppingCart, Truck } from 'lucide-react';
import { cn } from '@/shared/ui/cn';

export interface BottomNavTab {
  to: string;
  label: string;
  icon: 'inventario' | 'entregas' | 'ventas' | 'scanner';
}

interface BottomNavProps {
  tabs: BottomNavTab[];
}

const ICON_MAP = {
  inventario: Boxes,
  entregas: Truck,
  ventas: ShoppingCart,
  scanner: ScanLine,
};

export function BottomNav({ tabs }: BottomNavProps) {
  return (
    <nav
      aria-label="Secciones de la sucursal"
      className={cn(
        'md:hidden fixed bottom-4 left-4 right-4 z-30 max-w-md mx-auto',
        'soft-card bg-surface-raised/90 backdrop-blur-xl',
        'border border-surface-border',
        'rounded-full p-1.5',
        'mb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="flex items-center justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = ICON_MAP[tab.icon];
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-full text-xs font-medium',
                    'transition-all duration-150 active:scale-95',
                    isActive
                      ? 'bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] font-semibold shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-sunken/70',
                  )
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <span className="text-[10px] tracking-tight">{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
