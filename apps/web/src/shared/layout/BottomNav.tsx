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
        'fixed bottom-0 left-0 right-0 z-20 bg-surface-raised supports-[backdrop-filter]:bg-glass-nav backdrop-blur-sm will-change-[backdrop-filter]',
        'border-t border-glass-border',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="mx-auto max-w-4xl flex items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = ICON_MAP[tab.icon];
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 py-2.5 text-xs',
                    'transition-colors duration-150',
                    isActive ? 'text-brand-primary' : 'text-text-muted hover:text-text-secondary',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
