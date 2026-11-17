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
  AlertTriangle,
} from 'lucide-react';
import type { InventoryRow } from '@surmoda/contracts';
import { useInventoryGrouped } from '../hooks/useInventoryGrouped';
import { ProductDetailDrawer } from '../components/ProductDetailDrawer';
import { MovementsDrawer } from '../components/MovementsDrawer';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { SingleVariantQuickEditModal } from '../components/SingleVariantQuickEditModal';
import { cn } from '@/shared/ui/cn';
import { useStores } from '@/features/stores/hooks/useStores';
import { usePermissions } from '@/shared/auth/usePermissions';
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
import { useDebounce } from '@/shared/hooks/useDebounce';
// WHY: removed in Wave 5 — only admin edits inventory now (see ADR pending)

const PAGE_SIZE = 20;

export function SedeInventoryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId ?? '';

  const { can } = usePermissions();
  const stores = useStores();

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 300);
  const [page, setPage] = useState(1);
  const [stockStatus, setStockStatus] = useState<'all' | 'low' | 'zero'>('all');
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedVariant, setScannedVariant] = useState<InventoryRow | null>(null);

  const filteredQuery = useInventoryGrouped(storeId, {
    q: debouncedQ || undefined,
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

  // Wave 5: only admin can edit inventory; encargada sees read-only
  const canEditQuantity = can('inventory:edit');
  // Movements history visible to encargada+admin (has inventory:read)
  const canSeeMovements = can('inventory:read');

  const totalPages = filteredQuery.data
    ? Math.max(1, Math.ceil(filteredQuery.data.total / filteredQuery.data.pageSize))
    : 1;

  // WHY: vendedora can't reach this page (ProtectedRoute blocks); always show Ventas tab
  const bottomNav = useMemo<BottomNavTab[]>(() => {
    const tabs: BottomNavTab[] = [
      { to: `/sedes/${storeId}/inventario`, label: 'Inventario', icon: 'inventario' },
      { to: `/sedes/${storeId}/entregas`, label: 'Entregas', icon: 'entregas' },
    ];
    if (!isWarehouse) {
      tabs.push({ to: `/sedes/${storeId}/ventas`, label: 'Ventas', icon: 'ventas' });
      tabs.push({ to: `/sedes/${storeId}/scanner`, label: 'Scanner', icon: 'scanner' });
    }
    return tabs;
  }, [storeId, isWarehouse]);

  const openItem = openProductId
    ? filteredQuery.data?.items.find((i) => i.productId === openProductId)
    : undefined;

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-text-primary">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 pb-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shadow-xs shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Inventario</h1>
                {store && (
                  <Badge variant={isWarehouse ? 'info' : 'default'} dot>
                    {isWarehouse ? 'Almacén' : 'Sucursal'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-text-muted">Control de stock y catálogo de prendas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<ScanLine className="h-4 w-4" />}
              onClick={() => setScannerOpen(true)}
              className="shadow-sm shadow-brand-primary/25"
            >
              Escanear código
            </Button>
            {canSeeMovements && (
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

        {lowStockProbe.data && lowStockProbe.data.total > 0 && stockStatus !== 'low' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-status-warning/40 bg-status-warning-soft/60 backdrop-blur-xs px-4 py-3 shadow-xs">
            <p className="text-xs sm:text-sm font-medium text-status-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-status-warning" />
              <span>
                {lowStockProbe.data.total}{' '}
                {lowStockProbe.data.total === 1
                  ? 'producto requiere reposición'
                  : 'productos requieren reposición'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setStockStatus('low');
                setPage(1);
              }}
              className="text-xs font-semibold px-2.5 py-1 rounded-md bg-status-warning/15 text-status-warning hover:bg-status-warning/25 transition-all active:scale-95"
            >
              Ver productos
            </button>
          </div>
        )}

        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-subtle group-focus-within:text-brand-primary transition-colors pointer-events-none" />
          <Input
            id="inventory-search"
            type="search"
            placeholder="Buscar por código, prenda o código de barras..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-11 rounded-xl bg-surface-raised/80 backdrop-blur-xs border-surface-border/80 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all text-sm"
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
                className={cn(
                  'rounded-lg text-xs font-medium px-3 py-1.5 transition-all duration-150 active:scale-95 flex items-center gap-1.5',
                  active
                    ? 'bg-brand-primary text-white shadow-xs font-semibold'
                    : 'border border-surface-border bg-surface-raised text-text-secondary hover:bg-surface-sunken hover:border-surface-border-strong',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {filteredQuery.isLoading && (
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
                    {filteredQuery.data.items.map((row, idx) => {
                      const imageUrl = getImageUrl(row.imagePath);
                      return (
                        <li
                          key={row.productId}
                          className="border-b border-surface-border/70 last:border-b-0 animate-slide-up"
                          style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenProductId(row.productId)}
                            className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-sunken/80 transition-all text-left group active:bg-surface-sunken"
                          >
                            <div className="h-14 w-14 shrink-0 rounded-xl border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden shadow-2xs group-hover:border-brand-primary/40 group-hover:shadow-xs transition-all">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-text-subtle" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-text-primary truncate group-hover:text-brand-primary transition-colors">
                                {row.productName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-surface-sunken text-text-secondary border border-surface-border/60 font-tabular font-medium">
                                  {row.productCode}
                                </span>
                                {row.representativeBarcode && (
                                  <span className="text-[11px] font-mono text-text-muted truncate">
                                    {row.representativeBarcode}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted mt-1">
                                {row.variantsCount === 1
                                  ? '1 variante'
                                  : `${row.variantsCount} variantes`}
                              </p>
                              {(row.lowVariantsCount > 0 || row.zeroVariantsCount > 0) && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {row.zeroVariantsCount > 0 && (
                                    <span className="rounded-md bg-status-danger-soft/90 text-status-danger text-[11px] px-2 py-0.5 font-medium border border-status-danger/20 flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-status-danger animate-pulse" />
                                      {row.zeroVariantsCount} sin stock
                                    </span>
                                  )}
                                  {row.lowVariantsCount > 0 && (
                                    <span className="rounded-md bg-status-warning-soft/90 text-status-warning text-[11px] px-2 py-0.5 font-medium border border-status-warning/20 flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
                                      {row.lowVariantsCount} stock bajo
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end shrink-0 pl-2">
                              <span className="text-base font-bold text-text-primary font-tabular px-2.5 py-1 rounded-lg bg-surface-sunken/80 border border-surface-border/50 group-hover:border-brand-primary/30 transition-colors">
                                {row.totalQuantity}
                              </span>
                              <span className="text-[10px] text-text-subtle uppercase tracking-wider font-semibold mt-0.5">
                                Total
                              </span>
                            </div>
                            <ChevronRight className="h-5 w-5 text-text-subtle group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
                {filteredQuery.data.total > PAGE_SIZE && (
                  <CardFooter className="justify-between">
                    <span className="text-sm text-text-secondary">
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
