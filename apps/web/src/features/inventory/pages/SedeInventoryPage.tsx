import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Image as ImageIcon,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ScanLine,
} from 'lucide-react';
import type { InventoryRow } from '@surmoda/contracts';
import { useEditPermission, useToggleEditPermission } from '../hooks/useInventory';
import { useInventoryGrouped } from '../hooks/useInventoryGrouped';
import { ProductDetailDrawer } from '../components/ProductDetailDrawer';
import { MovementsDrawer } from '../components/MovementsDrawer';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { SingleVariantQuickEditModal } from '../components/SingleVariantQuickEditModal';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
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
  const [stockStatus, setStockStatus] = useState<'all' | 'low' | 'zero'>('all');
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedVariant, setScannedVariant] = useState<InventoryRow | null>(null);

  const filteredQuery = useInventoryGrouped(storeId, {
    q: q || undefined,
    stockStatus: stockStatus === 'all' ? undefined : stockStatus,
    page,
    pageSize: PAGE_SIZE,
  });

  // Total of low+zero so we can show the "requiere reposición" banner. Runs in
  // parallel with the main listing — server-side filter via stockStatus=low
  // returns the total.
  const lowStockProbe = useInventoryGrouped(storeId, {
    stockStatus: 'low',
    page: 1,
    pageSize: 1,
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
          <div className="flex items-center gap-2">
            <IconButton
              icon={<ScanLine className="h-5 w-5" />}
              label="Escanear código"
              variant="secondary"
              size="sm"
              onClick={() => setScannerOpen(true)}
            />
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
          </div>
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
                onClick={() => togglePermission.mutate({ isEnabled: !permission.data!.isEnabled })}
                isLoading={togglePermission.isPending}
                disabled={togglePermission.isPending}
              >
                {permission.data.isEnabled ? 'Deshabilitar' : 'Habilitar'}
              </Button>
            </CardContent>
          </Card>
        )}

        {lowStockProbe.data && lowStockProbe.data.total > 0 && stockStatus !== 'low' && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-sm text-amber-800 flex items-center gap-2">
              <span aria-hidden className="text-amber-600">
                ⚠
              </span>
              {lowStockProbe.data.total}{' '}
              {lowStockProbe.data.total === 1
                ? 'producto requiere reposición'
                : 'productos requieren reposición'}
            </p>
            <button
              type="button"
              onClick={() => {
                setStockStatus('low');
                setPage(1);
              }}
              className="text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
            >
              Ver
            </button>
          </div>
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

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { value: 'all', label: 'Todos' },
              { value: 'low', label: 'Stock bajo' },
              { value: 'zero', label: 'Sin stock' },
            ] as const
          ).map((opt) => {
            const active = stockStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setStockStatus(opt.value);
                  setPage(1);
                }}
                className={
                  active
                    ? 'rounded-full bg-slate-900 text-white text-xs font-semibold px-3 py-1.5'
                    : 'rounded-full border border-surface-border bg-white text-slate-600 text-xs px-3 py-1.5 hover:bg-surface-sunken'
                }
              >
                {opt.label}
              </button>
            );
          })}
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

        {filteredQuery.isError && <Alert variant="error">No pudimos cargar el inventario.</Alert>}

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
                                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {row.productName}
                              </p>
                              <p className="text-xs mt-0.5 font-mono flex items-center gap-1 flex-wrap">
                                <span className="text-slate-700">{row.productCode}</span>
                                {row.representativeBarcode && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-500 truncate">
                                      {row.representativeBarcode}
                                    </span>
                                  </>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {row.variantsCount === 1
                                  ? '1 variante'
                                  : `${row.variantsCount} variantes`}
                              </p>
                              {(row.lowVariantsCount > 0 || row.zeroVariantsCount > 0) && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {row.zeroVariantsCount > 0 && (
                                    <span className="rounded-full bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5">
                                      {row.zeroVariantsCount} sin stock
                                    </span>
                                  )}
                                  {row.lowVariantsCount > 0 && (
                                    <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5">
                                      {row.lowVariantsCount} variante
                                      {row.lowVariantsCount === 1 ? '' : 's'} con stock bajo
                                    </span>
                                  )}
                                </div>
                              )}
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
                      Página {filteredQuery.data.page} de {totalPages} · {filteredQuery.data.total}{' '}
                      producto
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

        <BarcodeScannerModal
          storeId={storeId}
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onResolved={(row) => setScannedVariant(row)}
        />

        <SingleVariantQuickEditModal
          storeId={storeId}
          row={scannedVariant}
          canEdit={canEditQuantity}
          onClose={() => setScannedVariant(null)}
        />
      </main>
    </AppShell>
  );
}
