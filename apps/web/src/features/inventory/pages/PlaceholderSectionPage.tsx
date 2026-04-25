import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Card, CardContent, EmptyState } from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';

interface PlaceholderSectionPageProps {
  section: 'entregas' | 'ventas' | 'scanner';
  title: string;
  description: string;
}

export function PlaceholderSectionPage({
  section,
  title,
  description,
}: PlaceholderSectionPageProps) {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId ?? '';
  const stores = useStores();
  const user = useAuthStore((s) => s.user);

  const store = stores.data?.items.find((s) => s.id === storeId);
  const isWarehouse = store?.kind === 'warehouse';

  const hasEncargadaRole = (user?.assignments ?? []).some((a) => a.role === 'encargada');
  const isAdmin = user?.isAdmin ?? false;
  const directRole = user?.assignments.find((a) => a.storeId === storeId)?.role;
  const isVendedoraHere = !isAdmin && !hasEncargadaRole && directRole === 'vendedora';

  const bottomNav = useMemo<BottomNavTab[]>(() => {
    const tabs: BottomNavTab[] = [
      { to: `/sedes/${storeId}/inventario`, label: 'Inventario', icon: 'inventario' },
      { to: `/sedes/${storeId}/entregas`, label: 'Entregas', icon: 'entregas' },
    ];
    if (!isWarehouse) {
      if (!isVendedoraHere) {
        tabs.push({ to: `/sedes/${storeId}/ventas`, label: 'Ventas', icon: 'ventas' });
      }
      tabs.push({ to: `/sedes/${storeId}/scanner`, label: 'Scanner', icon: 'scanner' });
    }
    return tabs;
  }, [storeId, isWarehouse, isVendedoraHere]);

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <Card>
          <CardContent>
            <EmptyState
              icon={<Construction className="h-6 w-6" />}
              title="Próximamente"
              description={description}
            />
          </CardContent>
        </Card>
        {/* WHY: keep `section` referenced so refactors that touch placeholders surface clearly. */}
        <p className="sr-only">section: {section}</p>
      </main>
    </AppShell>
  );
}
