import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronRight,
  Image as ImageIcon,
  Package,
  Search,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Skeleton,
} from '@/shared/ui';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useStores } from '@/features/stores/hooks/useStores';
import { useDeliveriesGrouped } from '../hooks/useDeliveries';
import { deliveriesService, deliveriesQueryKeys } from '../services/deliveriesService';
import { useQuery } from '@tanstack/react-query';
import { DeliveryDetailDrawer } from '../components/DeliveryDetailDrawer';
import { NewDeliveryModal } from '../components/NewDeliveryModal';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';
import { getImageUrl } from '@/features/products/services/productsService';

const PAGE_SIZE = 20;

export function DeliveriesPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId ?? '';
  const user = useAuthStore((s) => s.user);

  const stores = useStores();
  const store = stores.data?.items.find((s) => s.id === storeId);
  const isWarehouse = store?.kind === 'warehouse';

  const hasEncargadaRole = (user?.assignments ?? []).some((a) => a.role === 'encargada');
  const isAdmin = user?.isAdmin ?? false;
  const directRole = user?.assignments.find((a) => a.storeId === storeId)?.role;
  const isVendedoraHere = !isAdmin && !hasEncargadaRole && directRole === 'vendedora';
  const canCreate = isAdmin || hasEncargadaRole;

  const [q, setQ] = useState('');
  const grouped = useDeliveriesGrouped(storeId, { q: q || undefined, page: 1, pageSize: PAGE_SIZE });

  const [openDeliveryId, setOpenDeliveryId] = useState<string | null>(null);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // For the product-specific list, we re-use the deliveries list endpoint and filter
  // by product code locally — simple given a product detail typically has 1-2 deliveries.
  const productDeliveries = useQuery({
    queryKey: openProductId ? deliveriesQueryKeys.list(storeId, { q: openProductId }) : ['deliveries', 'product-noop'],
    queryFn: () => deliveriesService.list(storeId, { page: 1, pageSize: 50 }),
    enabled: Boolean(openProductId),
  });

  const filteredProductDeliveries = useMemo(() => {
    if (!openProductId || !productDeliveries.data) return [];
    return productDeliveries.data.items;
  }, [openProductId, productDeliveries.data]);

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
          {canCreate && (
            <Button type="button" variant="primary" size="sm" onClick={() => setNewOpen(true)}>
              Entregar
            </Button>
          )}
        </header>

        <p className="text-xs text-slate-500">Historial</p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar por código, nombre o barcode..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Buscar entregas"
          />
        </div>

        {grouped.isLoading && (
          <Card>
            <CardContent className="p-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 border-b border-surface-border last:border-b-0"
                >
                  <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {grouped.isError && <Alert variant="error">No pudimos cargar el historial.</Alert>}

        {grouped.data && (
          <>
            {grouped.data.items.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={<Package className="h-6 w-6" />}
                    title="Sin entregas todavía"
                    description={
                      canCreate
                        ? 'Tocá "Entregar" para registrar la primera.'
                        : 'Aún no se ha registrado ninguna entrega para esta sede.'
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul>
                    {grouped.data.items.map((g) => {
                      const url = getImageUrl(g.imagePath);
                      return (
                        <li
                          key={g.productId}
                          className="border-b border-surface-border last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenProductId(g.productId)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors text-left"
                          >
                            <div className="h-14 w-14 shrink-0 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden">
                              {url ? (
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {g.productName}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                {g.productCode}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {g.deliveryCount === 1
                                  ? '1 entrega'
                                  : `${g.deliveryCount} entregas`}
                              </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <span className="text-base font-semibold text-slate-900">
                                {g.totalUnits}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                                Total
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Product-deliveries inline list rendered as a modal */}
        {openProductId && (
          <ProductDeliveriesModal
            open
            onClose={() => setOpenProductId(null)}
            deliveries={filteredProductDeliveries}
            onPickDelivery={(id) => {
              setOpenProductId(null);
              setOpenDeliveryId(id);
            }}
          />
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
    </AppShell>
  );
}

interface ProductDeliveriesModalProps {
  open: boolean;
  onClose: () => void;
  deliveries: Array<{
    id: string;
    createdAt: string;
    createdByFullName: string;
    totalUnits: number;
    kind: 'reception' | 'distribution';
  }>;
  onPickDelivery: (id: string) => void;
}

import { Modal } from '@/shared/ui';

function ProductDeliveriesModal({
  open,
  onClose,
  deliveries,
  onPickDelivery,
}: ProductDeliveriesModalProps) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Entregas del producto">
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {deliveries.length === 0 ? (
          <p className="text-sm text-slate-500">Sin entregas.</p>
        ) : (
          deliveries.map((d) => (
            <button
              type="button"
              key={d.id}
              onClick={() => onPickDelivery(d.id)}
              className="text-left flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 hover:bg-surface-sunken transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-900">
                  {new Date(d.createdAt).toLocaleString('es-BO', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
                <p className="text-xs text-slate-500">
                  {d.kind === 'reception' ? 'Recepción' : 'Distribución'} · por{' '}
                  {d.createdByFullName}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-900 shrink-0">
                {d.totalUnits} u.
              </span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
