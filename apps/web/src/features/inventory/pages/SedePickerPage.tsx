import { Link, Navigate } from 'react-router-dom';
import { Boxes, ChevronRight, Store as StoreIcon, Warehouse } from 'lucide-react';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { usePermissions } from '@/shared/auth/usePermissions';
import { Alert, Badge, Card, CardContent, EmptyState, Skeleton } from '@/shared/ui';
import { AppShell } from '@/shared/layout/AppShell';

// WHY: vendedora no tiene inventory:read post-Wave 5, va al scanner;
// encargada/admin pueden ir a inventario.
function landingPathFor(role: string | null, storeId: string): string {
  if (role === 'vendedora') return `/sedes/${storeId}/scanner`;
  return `/sedes/${storeId}/inventario`;
}

export function SedePickerPage() {
  const query = useStores();
  const user = useAuthStore((s) => s.user);
  const { role } = usePermissions();

  if (query.isLoading) {
    return (
      <AppShell>
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
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

  return (
    <AppShell>
      <div className="relative min-h-[calc(100dvh-57px)] bg-surface-base overflow-hidden">
        {/* Subtle decorative ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-brand-primary/10 blur-[120px] pointer-events-none rounded-full" />

        <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 text-text-primary">
          <header className="flex flex-col gap-1.5 pt-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-brand-primary">
              Sistema de Gestión
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight animate-fade-in">
              Elegí una sede
            </h1>
            <p className="text-sm text-text-muted animate-slide-up">
              Seleccioná la sucursal o el almacén con el que vas a operar hoy.
            </p>
          </header>

          {items.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<Boxes className="h-6 w-6" />}
                  title="Sin sedes asignadas"
                  description="Pedile a tu admin que te asigne a una sucursal."
                />
              </CardContent>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {items.map((s, idx) => {
                const isWarehouse = s.kind === 'warehouse';
                const Icon = isWarehouse ? Warehouse : StoreIcon;
                return (
                  <li
                    key={s.id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <Link to={landingPathFor(role, s.id)} className="block group">
                      <Card className="p-4 border-surface-border/80 bg-surface-raised/70 backdrop-blur-xs hover:border-brand-primary/60 hover:shadow-md transition-all duration-200 active:scale-[0.98]">
                        <div className="flex items-center gap-3.5">
                          <div className="h-11 w-11 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0 group-hover:bg-brand-primary group-hover:text-white transition-all duration-200">
                            <Icon className="h-5 w-5 text-brand-primary group-hover:text-white transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-text-primary truncate">
                                {s.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-sunken text-text-muted font-tabular">
                                {s.code}
                              </span>
                              <Badge variant={isWarehouse ? 'info' : 'default'}>
                                {isWarehouse ? 'Almacén' : 'Sucursal'}
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-text-subtle group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </AppShell>
  );
}
