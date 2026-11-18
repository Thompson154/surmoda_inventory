import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search, Truck } from 'lucide-react';
import type { DeliveryStatus } from '@surmoda/contracts';
import { useDeliveriesList } from '../hooks/useDeliveries';
import { DeliveryDetailDrawer } from '../components/DeliveryDetailDrawer';
import { NewDeliveryModal } from '../components/NewDeliveryModal';
import { TransferToStoreModal } from '../components/TransferToStoreModal';
import { WarehouseIntakeModal } from '../components/WarehouseIntakeModal';
import { Alert, Badge, Card, CardContent, EmptyState, Input, Skeleton } from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';
import { useStoreParam } from '@/shared/hooks/useStoreParam';
import { useStoreScope } from '@/shared/hooks/useStoreScope';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';

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
  draft: { bg: 'bg-surface-sunken', text: 'text-text-secondary' },
  sent: { bg: 'bg-status-warning-soft', text: 'text-status-warning' },
  received: { bg: 'bg-status-success-soft', text: 'text-status-success' },
  partial: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const MONTH_ABBR = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

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
  const debouncedQ = useDebounce(q, 300);
  const [filter, setFilter] = useState<Filter>('all');
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [openDeliveryId, setOpenDeliveryId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const list = useDeliveriesList(storeId, {
    q: debouncedQ || undefined,
    status: FILTER_TO_STATUS[filter],
    direction,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const bottomNav = useMemo<BottomNavTab[]>(() => {
    const tabs: BottomNavTab[] = [];
    // WHY: vendedora NO ve Inventario (Wave 5 le quitó inventory:read).
    if (!isVendedoraHere) {
      tabs.push({ to: `/sedes/${storeId}/inventario`, label: 'Inventario', icon: 'inventario' });
    }
    tabs.push({ to: `/sedes/${storeId}/entregas`, label: 'Entregas', icon: 'entregas' });
    if (!isWarehouse) {
      // WHY: Ventas visible para TODOS — vendedora ve sólo cierres, encargada/admin ven todo.
      tabs.push({ to: `/sedes/${storeId}/ventas`, label: 'Ventas', icon: 'ventas' });
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
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-text-primary">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
              Entregas
            </h1>
            {store && (
              <Badge variant={isWarehouse ? 'info' : 'default'}>
                {isWarehouse ? 'Almacén' : 'Sucursal'}
              </Badge>
            )}
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nueva entrega</span>
              </button>
              <button
                type="button"
                onClick={() => setTransferOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-raised text-text-secondary px-3 py-1.5 text-xs font-semibold hover:bg-surface-sunken active:scale-[0.98] transition"
                aria-label="Transferir a sede"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Transferir</span>
              </button>
            </div>
          )}
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-subtle pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar entrega, código o prenda..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-11 h-11 rounded-full bg-surface-raised border-surface-border shadow-2xs"
            aria-label="Buscar entregas"
          />
        </div>

        {/* Direction tabs — Recibidas vs Enviadas. Module 11 surfaces what
            this store SENT (lateral transfers / returns) in addition to the
            historical "incoming" view. Hidden for the warehouse since it is
            always the origin of legacy distributions. */}
        {!isWarehouse && (
          <div className="flex items-center gap-1 rounded-full bg-surface-sunken p-1 self-start">
            {[
              { value: 'incoming' as const, label: 'Recibidas' },
              { value: 'outgoing' as const, label: 'Enviadas' },
            ].map((d) => {
              const active = direction === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDirection(d.value)}
                  className={
                    active
                      ? 'rounded-full bg-surface-raised text-text-primary text-xs font-semibold px-3 py-1 shadow-sm'
                      : 'rounded-full text-text-muted text-xs px-3 py-1 hover:text-text-secondary'
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        )}

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
                    ? 'rounded-full bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] text-xs font-semibold px-4 py-1.5 shadow-xs'
                    : 'rounded-full border border-surface-border bg-surface-raised text-text-secondary text-xs px-4 py-1.5 hover:bg-surface-sunken'
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
          <ul className="flex flex-col gap-2.5">
            {list.data.items.map((d, idx) => {
              const palette = STATUS_PALETTE[d.status];
              return (
                <li
                  key={d.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDeliveryId(d.id)}
                    className="group w-full flex items-center gap-3.5 rounded-2xl border border-surface-border/80 bg-surface-raised/90 backdrop-blur-sm px-4 py-3.5 shadow-2xs hover:shadow-md hover:border-brand-primary/40 hover:-translate-y-0.5 transition-all duration-200 text-left"
                  >
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-surface-border/50 group-hover:scale-105 transition-transform">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-muted font-mono font-tabular">
                        {shortDate(d.createdAt)} · {formatNumber(d.number)}
                      </p>
                      <p className="text-sm font-semibold text-text-primary truncate mt-0.5">
                        {d.title ?? 'Entrega sin título'}
                      </p>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {d.fromStoreName ?? 'Almacén'} · {d.totalUnits}{' '}
                        {d.totalUnits === 1 ? 'prenda' : 'prendas'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full ${palette.bg} ${palette.text} text-xs font-semibold px-2.5 py-0.5`}
                    >
                      {STATUS_LABEL[d.status]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-text-subtle group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DeliveryDetailDrawer deliveryId={openDeliveryId} onClose={() => setOpenDeliveryId(null)} />

        {canCreate && !isWarehouse && (
          <NewDeliveryModal storeId={storeId} open={newOpen} onClose={() => setNewOpen(false)} />
        )}
        {canCreate && (
          <TransferToStoreModal
            fromStoreId={storeId}
            open={transferOpen}
            onClose={() => setTransferOpen(false)}
          />
        )}
        {canCreate && isWarehouse && (
          <WarehouseIntakeModal
            warehouseId={storeId}
            open={newOpen}
            onClose={() => setNewOpen(false)}
          />
        )}
      </main>

      {/* Mobile FAB Nueva entrega (desktop uses inline header button) */}
      {canCreate && (
        <div className="md:hidden fixed bottom-24 right-4 z-30">
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="h-13 w-13 rounded-full bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] shadow-xl shadow-black/20 active:scale-95 transition-all flex items-center justify-center hover:scale-105"
            aria-label="Nueva entrega"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      )}
    </AppShell>
  );
}
