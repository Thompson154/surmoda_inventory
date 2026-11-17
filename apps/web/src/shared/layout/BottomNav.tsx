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
        'fixed bottom-0 left-0 right-0 z-20 bg-surface-raised/90 supports-[backdrop-filter]:bg-glass-nav backdrop-blur-md',
        'border-t border-surface-border/80 shadow-lg',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="mx-auto max-w-lg flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = ICON_MAP[tab.icon];
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-medium',
                    'transition-all duration-150 active:scale-95',
                    isActive
                      ? 'text-brand-primary bg-brand-primary/10 shadow-xs font-semibold'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-sunken/60',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px] tracking-tight">{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
