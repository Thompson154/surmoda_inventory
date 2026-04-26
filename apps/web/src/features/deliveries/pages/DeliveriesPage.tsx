import { useMemo, useState } from 'react';
import { ChevronRight, Search, Truck } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  CardContent,
  EmptyState,
  Input,
  Skeleton,
} from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';
import { useStoreParam } from '@/shared/hooks/useStoreParam';
import { useStoreScope } from '@/shared/hooks/useStoreScope';
import { useDeliveriesList } from '../hooks/useDeliveries';
import { DeliveryDetailDrawer } from '../components/DeliveryDetailDrawer';
import { NewDeliveryModal } from '../components/NewDeliveryModal';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';
import type { DeliveryStatus } from '@surmoda/contracts';

const PAGE_SIZE = 30;

type Filter = 'all' | 'pending' | 'partial' | 'received';

const FILTER_TO_STATUS: Record<Filter, DeliveryStatus[] | undefined> = {
  all: undefined,
  pending: ['draft', 'sent'],
  partial: ['partial'],
  received: ['received'],
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  received: 'Recibida',
  partial: 'Parcial',
};

const STATUS_PALETTE: Record<DeliveryStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
  sent: { bg: 'bg-amber-100', text: 'text-amber-700' },
  received: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  partial: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

function formatNumber(n: number): string {
  return `EN-${n.toString().padStart(4, '0')}`;
}

export function DeliveriesPage() {
  const storeId = useStoreParam() ?? '';
  const stores = useStores();
  const store = stores.data?.items.find((s) => s.id === storeId);
  const isWarehouse = store?.kind === 'warehouse';
  const { canManage, isVendedoraHere } = useStoreScope(storeId);
  const canCreate = canManage;

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openDeliveryId, setOpenDeliveryId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const list = useDeliveriesList(storeId, {
    q: q || undefined,
    status: FILTER_TO_STATUS[filter],
    page: 1,
    pageSize: PAGE_SIZE,
  });

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

  const filterTabs: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'partial', label: 'Parciales' },
    { value: 'received', label: 'Recibidas' },
  ];

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-semibold truncate">Entregas</h1>
            {store && (
              <Badge variant={isWarehouse ? 'info' : 'default'}>
                {isWarehouse ? 'Almacén' : 'Sucursal'}
              </Badge>
            )}
          </div>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar por título, código o barcode..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Buscar entregas"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((t) => {
            const active = filter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setFilter(t.value)}
                className={
                  active
                    ? 'rounded-full bg-slate-900 text-white text-xs font-semibold px-4 py-1.5'
                    : 'rounded-full border border-surface-border bg-white text-slate-600 text-xs px-4 py-1.5 hover:bg-surface-sunken'
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {list.isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {list.isError && <Alert variant="error">No pudimos cargar las entregas.</Alert>}

        {list.data && list.data.items.length === 0 && (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title="Sin entregas en este filtro"
                description={
                  canCreate
                    ? 'Tocá "Nueva entrega" para registrar una.'
                    : 'No hay entregas en este filtro para esta sede.'
                }
              />
            </CardContent>
          </Card>
        )}

        {list.data && list.data.items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {list.data.items.map((d) => {
              const palette = STATUS_PALETTE[d.status];
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setOpenDeliveryId(d.id)}
                    className="w-full flex items-center gap-3 rounded-lg border border-surface-border bg-white px-3 py-3 hover:bg-surface-sunken transition-colors text-left"
                  >
                    <div className="h-11 w-11 shrink-0 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 font-mono">
                        {shortDate(d.createdAt)} · {formatNumber(d.number)}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {d.title ?? 'Entrega sin título'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {d.fromStoreName ?? 'Almacén'} · {d.totalUnits}{' '}
                        {d.totalUnits === 1 ? 'prenda' : 'prendas'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full ${palette.bg} ${palette.text} text-xs font-semibold px-2.5 py-0.5`}
                    >
                      {STATUS_LABEL[d.status]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DeliveryDetailDrawer
          deliveryId={openDeliveryId}
          onClose={() => setOpenDeliveryId(null)}
        />

        {canCreate && (
          <NewDeliveryModal
            storeId={storeId}
            open={newOpen}
            onClose={() => setNewOpen(false)}
          />
        )}
      </main>

      {/* FAB Nueva entrega — visible solo a admin/encargada. */}
      {canCreate && (
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white px-5 py-3 shadow-lg hover:shadow-xl active:scale-[0.98] transition"
          aria-label="Nueva entrega"
        >
          <span className="text-xl leading-none">+</span>
          <span className="font-semibold">Nueva entrega</span>
        </button>
      )}
    </AppShell>
  );
}
