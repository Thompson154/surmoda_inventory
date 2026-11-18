import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Boxes,
  ChevronRight,
  Store as StoreIcon,
  Warehouse,
  Sparkles,
  Globe,
  MapPin,
} from 'lucide-react';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { usePermissions } from '@/shared/auth/usePermissions';
import { Alert, Card, CardContent, EmptyState, Skeleton, cn } from '@/shared/ui';
import { AppShell } from '@/shared/layout/AppShell';

// WHY: vendedora no tiene inventory:read post-Wave 5, va al scanner;
// encargada/admin pueden ir a inventario.
function landingPathFor(role: string | null, storeId: string): string {
  if (role === 'vendedora') return `/sedes/${storeId}/scanner`;
  return `/sedes/${storeId}/inventario`;
}

interface StoreMeta {
  location: string;
  tagline: string;
  gradient: string;
  borderHover: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STORE_META: Record<string, StoreMeta & { pastel: string }> = {
  ALMACEN: {
    location: 'Centro de Distribución · Casa Matriz',
    tagline: 'Stock matriz y despachos',
    gradient: '',
    borderHover: '',
    pastel: 'bg-[#FAF1DC] border-[#EAD9B0] dark:bg-amber-950/30 dark:border-amber-500/20',
    Icon: Warehouse,
  },
  PRADO: {
    location: 'Av. 16 de Julio · El Prado',
    tagline: 'Boutique central',
    gradient: '',
    borderHover: '',
    pastel: 'bg-[#EEE8FB] border-[#DBD0F5] dark:bg-violet-950/30 dark:border-violet-500/20',
    Icon: StoreIcon,
  },
  ZSUR: {
    location: 'Calacoto · Calle 21',
    tagline: 'Boutique alta moda',
    gradient: '',
    borderHover: '',
    pastel: 'bg-[#E3F5EC] border-[#C5E9D6] dark:bg-emerald-950/30 dark:border-emerald-500/20',
    Icon: Sparkles,
  },
  SATELITE: {
    location: 'Ciudad Satélite · El Alto',
    tagline: 'Sucursal comercial',
    gradient: '',
    borderHover: '',
    pastel: 'bg-[#E6F0FC] border-[#CADDF7] dark:bg-sky-950/30 dark:border-sky-500/20',
    Icon: StoreIcon,
  },
  ONLINE: {
    location: 'Canal Digital & Redes',
    tagline: 'Envíos nacionales',
    gradient: '',
    borderHover: '',
    pastel: 'bg-[#FCECE8] border-[#F6D5CC] dark:bg-rose-950/30 dark:border-rose-500/20',
    Icon: Globe,
  },
};

export function SedePickerPage() {
  const query = useStores();
  const user = useAuthStore((s) => s.user);
  const { role } = usePermissions();
  const [filter, setFilter] = useState<'all' | 'branch' | 'warehouse'>('all');

  if (query.isLoading) {
    return (
      <AppShell>
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </main>
      </AppShell>
    );
  }

  if (query.isError) {
    return (
      <AppShell>
        <main className="mx-auto max-w-4xl p-4">
          <Alert variant="error">No pudimos cargar las sedes.</Alert>
        </main>
      </AppShell>
    );
  }

  const items = query.data?.items ?? [];

  // Auto-redirect when the user has exactly one accessible store (typical vendedora case).
  if (items.length === 1 && !user?.isAdmin) {
    return <Navigate to={landingPathFor(role, items[0]!.id)} replace />;
  }

  const firstName = user?.fullName?.split(' ')[0] ?? 'Colega';

  const warehouseCount = items.filter((s) => s.kind === 'warehouse').length;
  const branchCount = items.filter((s) => s.kind !== 'warehouse').length;
  const visibleItems = items.filter((s) => {
    if (filter === 'warehouse') return s.kind === 'warehouse';
    if (filter === 'branch') return s.kind !== 'warehouse';
    return true;
  });

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-57px)] text-text-primary">
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-6 p-3.5 sm:p-7">
          {/* Compact Circular Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-primary animate-fade-in">
                Bienvenido, {firstName}
              </h1>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5 animate-slide-up">
                Seleccioná una sucursal para operar.
              </p>
            </div>

            {/* Interactive Counter Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'Todas', count: items.length },
                  { id: 'branch', label: 'Boutiques', count: branchCount },
                  { id: 'warehouse', label: 'Almacén', count: warehouseCount },
                ] as const
              ).map((tab) => {
                const isActive = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95',
                      isActive
                        ? 'bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] font-semibold shadow-xs'
                        : 'bg-surface-raised border border-surface-border text-text-secondary hover:bg-surface-sunken',
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="font-tabular opacity-80">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </header>

          {visibleItems.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<Boxes className="h-6 w-6" />}
                  title="Sin sedes asignadas"
                  description="Pedile a tu administrador que te asigne a una sucursal."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              {visibleItems.map((s, idx) => {
                const isWarehouse = s.kind === 'warehouse';
                const meta = STORE_META[s.code] ?? {
                  location: 'Sede Comercial',
                  tagline: 'Atención e inventario',
                  gradient: '',
                  borderHover: '',
                  pastel: 'bg-surface-raised border-surface-border',
                  Icon: isWarehouse ? Warehouse : StoreIcon,
                };
                const Icon = meta.Icon;

                return (
                  <Link
                    key={s.id}
                    to={landingPathFor(role, s.id)}
                    className={cn(
                      'group block rounded-2xl border p-3 sm:p-4 soft-card',
                      'hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 transition-all duration-150',
                      'animate-slide-up flex items-center justify-between gap-3',
                      meta.pastel,
                    )}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-white/90 dark:bg-black/25 border border-black/[0.06] dark:border-white/10 flex items-center justify-center text-text-primary shadow-2xs shrink-0">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="font-display text-base font-bold tracking-tight text-text-primary truncate">
                            {s.name}
                          </h2>
                        </div>
                        <p className="text-[11px] text-text-secondary/80 mt-0.5 flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0 opacity-60" />
                          <span className="truncate">{meta.location}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/75 dark:bg-black/25 text-text-secondary">
                        {isWarehouse ? 'Almacén' : 'Boutique'}
                      </span>
                      <div className="h-8 w-8 rounded-full bg-white dark:bg-black/30 text-text-primary flex items-center justify-center shadow-2xs group-hover:bg-[#111318] group-hover:text-white dark:group-hover:bg-[#e3ff6a] dark:group-hover:text-[#111318] transition-colors">
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
