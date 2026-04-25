import { Link, Navigate } from 'react-router-dom';
import { Boxes, ChevronRight, Store as StoreIcon, Warehouse } from 'lucide-react';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { Alert, Badge, Card, CardContent, EmptyState, Skeleton } from '@/shared/ui';
import { AppShell } from '@/shared/layout/AppShell';

export function SedePickerPage() {
  const query = useStores();
  const user = useAuthStore((s) => s.user);

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
    return <Navigate to={`/sedes/${items[0]!.id}/inventario`} replace />;
  }

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Elegí una sede</h1>
          <p className="text-sm text-slate-500">
            Tocá la sucursal o el almacén con el que vas a operar.
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
          <ul className="flex flex-col gap-2">
            {items.map((s) => {
              const Icon = s.kind === 'warehouse' ? Warehouse : StoreIcon;
              return (
                <li key={s.id}>
                  <Link to={`/sedes/${s.id}/inventario`} className="block">
                    <Card className="hover:bg-surface-sunken transition-colors duration-150">
                      <CardContent className="flex items-center gap-3 py-4">
                        <div className="h-10 w-10 rounded-full bg-surface-sunken flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{s.code}</p>
                        </div>
                        <Badge variant={s.kind === 'warehouse' ? 'info' : 'default'}>
                          {s.kind === 'warehouse' ? 'Almacén' : 'Sucursal'}
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
