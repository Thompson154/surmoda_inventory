import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Image as ImageIcon,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  EmptyState,
  IconButton,
  Input,
  Skeleton,
} from '@/shared/ui';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useStores } from '@/features/stores/hooks/useStores';
import { useEditPermission, useToggleEditPermission } from '../hooks/useInventory';
import { useInventoryGrouped } from '../hooks/useInventoryGrouped';
import { ProductDetailDrawer } from '../components/ProductDetailDrawer';
import { MovementsDrawer } from '../components/MovementsDrawer';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';
import { getImageUrl } from '@/features/products/services/productsService';

const PAGE_SIZE = 20;

export function SedeInventoryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId ?? '';
  const user = useAuthStore((s) => s.user);

  const stores = useStores();
  const inventory = useInventoryGrouped(storeId, { page: 1, pageSize: PAGE_SIZE });
  const permission = useEditPermission(storeId);
  const togglePermission = useToggleEditPermission(storeId);

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [openProductId, setOpenProductId] = useState<string | null>(null);

  const filteredQuery = useInventoryGrouped(storeId, {
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const store = stores.data?.items.find((s) => s.id === storeId);
  const isWarehouse = store?.kind === 'warehouse';

  const hasEncargadaRole = (user?.assignments ?? []).some((a) => a.role === 'encargada');
  const isAdmin = user?.isAdmin ?? false;
  const isEncargada = !isAdmin && hasEncargadaRole;
  const directRole = user?.assignments.find((a) => a.storeId === storeId)?.role;
  const isVendedoraHere = !isAdmin && !isEncargada && directRole === 'vendedora';
  const canManagePermission = isAdmin || isEncargada;
  const canEditQuantity =
    isAdmin || isEncargada || (isVendedoraHere && permission.data?.isEnabled === true);

  const totalPages = filteredQuery.data
    ? Math.max(1, Math.ceil(filteredQuery.data.total / filteredQuery.data.pageSize))
    : 1;

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

  const openItem = openProductId
    ? filteredQuery.data?.items.find((i) => i.productId === openProductId)
    : undefined;

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-semibold truncate">Inventario</h1>
            {store && (
              <Badge variant={isWarehouse ? 'info' : 'default'}>
                {isWarehouse ? 'Almacén' : 'Sucursal'}
              </Badge>
            )}
          </div>
          {canManagePermission && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<ClipboardList className="h-4 w-4" />}
              onClick={() => setMovementsOpen(true)}
            >
              Movimientos
            </Button>
          )}
        </header>

        {canManagePermission && permission.data && !isWarehouse && (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">Edición por vendedoras</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {permission.data.isEnabled
                    ? 'Las vendedoras pueden ajustar cantidades.'
                    : 'Solo encargada/admin puede ajustar.'}
                </p>
              </div>
              <Button
                type="button"
                variant={permission.data.isEnabled ? 'danger' : 'primary'}
                size="sm"
                onClick={() =>
                  togglePermission.mutate({ isEnabled: !permission.data!.isEnabled })
                }
                isLoading={togglePermission.isPending}
                disabled={togglePermission.isPending}
              >
                {permission.data.isEnabled ? 'Deshabilitar' : 'Habilitar'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            id="inventory-search"
            type="search"
            placeholder="Buscar por código, nombre o barcode..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-9"
            aria-label="Buscar inventario"
          />
        </div>

        {filteredQuery.isLoading && !inventory.data && (
          <Card>
            <CardContent className="p-0">
              {Array.from({ length: 5 }).map((_, i) => (
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

        {filteredQuery.isError && (
          <Alert variant="error">No pudimos cargar el inventario.</Alert>
        )}

        {filteredQuery.data && (
          <>
            {filteredQuery.data.items.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={<Package className="h-6 w-6" />}
                    title="Sin resultados"
                    description="Probá con otro código o nombre."
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul>
                    {filteredQuery.data.items.map((row) => {
                      const imageUrl = getImageUrl(row.imagePath);
                      return (
                        <li
                          key={row.productId}
                          className="border-b border-surface-border last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenProductId(row.productId)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors text-left"
                          >
                            <div className="h-14 w-14 shrink-0 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {row.productName}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                {row.productCode}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {row.variantsCount === 1
                                  ? '1 variante'
                                  : `${row.variantsCount} variantes`}
                              </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <span className="text-base font-semibold text-slate-900">
                                {row.totalQuantity}
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
                {filteredQuery.data.total > PAGE_SIZE && (
                  <CardFooter className="justify-between">
                    <span className="text-sm text-slate-600">
                      Página {filteredQuery.data.page} de {totalPages} ·{' '}
                      {filteredQuery.data.total} producto
                      {filteredQuery.data.total === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        icon={<ChevronLeft className="h-4 w-4" />}
                        label="Anterior"
                        size="sm"
                        variant="secondary"
                        disabled={filteredQuery.data.page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      />
                      <IconButton
                        icon={<ChevronRight className="h-4 w-4" />}
                        label="Siguiente"
                        size="sm"
                        variant="secondary"
                        disabled={filteredQuery.data.page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      />
                    </div>
                  </CardFooter>
                )}
              </Card>
            )}
          </>
        )}

        <ProductDetailDrawer
          storeId={storeId}
          productId={openProductId}
          productName={openItem?.productName}
          productCode={openItem?.productCode}
          canEdit={canEditQuantity}
          onClose={() => setOpenProductId(null)}
        />

        <MovementsDrawer
          storeId={storeId}
          open={movementsOpen}
          onClose={() => setMovementsOpen(false)}
        />
      </main>
    </AppShell>
  );
}
