import { useMemo, useState } from 'react';
import { Banknote, Check, CreditCard, QrCode, RotateCcw, ScanLine } from 'lucide-react';
import type { SaleItemDTO, SaleWithItems } from '@surmoda/contracts';
import { useSales, useSalesDashboard } from '../hooks/useSales';
import { CashierModal } from '../components/CashierModal';
import { CloseDayModal } from '../components/CloseDayModal';
import { ReturnScannerModal } from '../components/ReturnScannerModal';
import { Alert, Button, Card, CardContent, Modal, Skeleton } from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';
import { useStoreParam } from '@/shared/hooks/useStoreParam';
import { useStoreScope } from '@/shared/hooks/useStoreScope';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';
import { formatBsBig, formatBsShort } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';
import { getImageUrl } from '@/features/products/services/productsService';

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface FlatItemRow {
  saleId: string;
  itemId: string;
  paymentMethod: 'qr' | 'cash' | 'card';
  createdAt: string;
  productCode: string;
  productName: string;
  size: string;
  color: string;
  imagePath: string | null;
  quantity: number;
  catalogTotalCents: number;
  subtotalCents: number;
}

function flattenSales(sales: SaleWithItems[]): FlatItemRow[] {
  const out: FlatItemRow[] = [];
  for (const s of sales) {
    for (const it of s.items as SaleItemDTO[]) {
      out.push({
        saleId: s.id,
        itemId: it.id,
        paymentMethod: s.paymentMethod,
        createdAt: s.createdAt,
        productCode: it.productCode,
        productName: it.productName,
        size: sizeLabel(it.size),
        color: it.color,
        imagePath: it.imagePath ?? null,
        quantity: it.quantity,
        catalogTotalCents: it.priceAtSaleCents * it.quantity,
        subtotalCents: it.subtotalCents,
      });
    }
  }
  return out;
}

interface PaymentRowProps {
  label: 'QR' | 'Efectivo' | 'Tarjeta';
  cents: number;
  totalCents: number;
}

function PaymentRow({ label, cents, totalCents }: PaymentRowProps) {
  const pct = totalCents === 0 ? 0 : Math.round((cents / totalCents) * 100);
  const palette = {
    QR: {
      card: 'bg-[#EEE8FB]/75 dark:bg-violet-950/30 border-[#DDD3F6] dark:border-violet-500/20',
      iconWrap: 'bg-white dark:bg-black/30 text-violet-700 dark:text-violet-300',
      bar: 'bg-violet-600 dark:bg-violet-400',
      Icon: QrCode,
    },
    Efectivo: {
      card: 'bg-[#E3F5EC]/75 dark:bg-emerald-950/30 border-[#C7EAD7] dark:border-emerald-500/20',
      iconWrap: 'bg-white dark:bg-black/30 text-emerald-700 dark:text-emerald-300',
      bar: 'bg-emerald-600 dark:bg-emerald-400',
      Icon: Banknote,
    },
    Tarjeta: {
      card: 'bg-[#FAF1DC]/75 dark:bg-amber-950/30 border-[#EAD9B0] dark:border-amber-500/20',
      iconWrap: 'bg-white dark:bg-black/30 text-amber-700 dark:text-amber-300',
      bar: 'bg-amber-600 dark:bg-amber-400',
      Icon: CreditCard,
    },
  }[label];
  const { Icon } = palette;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border ${palette.card}`}>
      <div
        className={`h-9 w-9 rounded-full ${palette.iconWrap} flex items-center justify-center shrink-0 shadow-2xs`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-text-primary">{label}</span>
          <span className="text-text-secondary font-semibold font-tabular">
            {formatBsShort(cents)} · {pct}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/70 dark:bg-black/30 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${palette.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface ItemSaleCardProps {
  row: FlatItemRow;
  index?: number;
  onImageClick: (src: string) => void;
}

function ItemSaleCard({ row, index = 0, onImageClick }: ItemSaleCardProps) {
  const palette =
    row.paymentMethod === 'qr'
      ? {
          bg: 'bg-violet-100 dark:bg-violet-950/50',
          text: 'text-violet-600 dark:text-violet-400',
          Icon: QrCode,
        }
      : row.paymentMethod === 'cash'
        ? {
            bg: 'bg-emerald-100 dark:bg-emerald-950/50',
            text: 'text-emerald-600 dark:text-emerald-400',
            Icon: Banknote,
          }
        : { bg: 'bg-surface-sunken', text: 'text-text-secondary', Icon: CreditCard };
  const { Icon } = palette;
  const src = getImageUrl(row.imagePath);
  const showDiscount = row.subtotalCents !== row.catalogTotalCents;

  return (
    <div
      className="group flex items-center gap-3 rounded-2xl border border-surface-border/80 bg-surface-raised/90 backdrop-blur-sm px-3.5 py-3 shadow-2xs hover:shadow-md hover:border-brand-primary/40 hover:-translate-y-0.5 transition-all duration-200 animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      {src ? (
        <button
          type="button"
          onClick={() => onImageClick(src)}
          className="h-12 w-12 rounded-xl overflow-hidden bg-surface-sunken shrink-0 border border-surface-border/60 focus:outline focus:outline-brand-primary group-hover:border-brand-primary/50 transition-colors"
          aria-label="Ver imagen del producto"
        >
          <img
            src={src}
            alt={row.productName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </button>
      ) : (
        <div
          className={`h-12 w-12 rounded-xl ${palette.bg} ${palette.text} flex items-center justify-center shrink-0 border border-surface-border/40`}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          {row.productCode} · <span className="capitalize">{row.color}</span> · {row.size}
        </p>
        <p className="text-xs text-text-muted mt-0.5 font-tabular">
          {timeOfDay(row.createdAt)} · {row.quantity} {row.quantity === 1 ? 'unidad' : 'unidades'}
        </p>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <div
          className={`h-5 w-5 rounded-md ${palette.bg} ${palette.text} flex items-center justify-center mb-0.5`}
        >
          <Icon className="h-3 w-3" />
        </div>
        {showDiscount && (
          <p className="text-[10px] text-text-subtle font-mono line-through font-tabular">
            {formatBsBig(row.catalogTotalCents)}
          </p>
        )}
        <p className="text-sm font-mono font-bold text-text-primary font-tabular">
          {formatBsBig(row.subtotalCents)}
        </p>
      </div>
    </div>
  );
}

function getTodayIsoBolivia(): string {
  const local = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function SalesRegisterPage() {
  const storeId = useStoreParam() ?? '';
  const stores = useStores();
  const store = stores.data?.items.find((s) => s.id === storeId);
  const isWarehouse = store?.kind === 'warehouse';
  const { canManage: canSeeDashboard, isVendedoraHere } = useStoreScope(storeId);

  const todayList = useSales(storeId, { page: 1, pageSize: 50 });
  const dashboard = useSalesDashboard(canSeeDashboard ? storeId : undefined);

  const [cashierOpen, setCashierOpen] = useState(false);
  const [closeDayOpen, setCloseDayOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lastSale, setLastSale] = useState<SaleWithItems | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  // Local-only "view reset" the day was closed — wipes the visible totals and
  // the today list without persisting a sales-blocking lock. Holds the timestamp
  // of the cierre; sales recorded BEFORE this moment get filtered out.
  //
  // FUTURE: replace with a server-side daily-open/close flag so 22:00 auto-locks
  // new sales registration and 00:00 wipes the in-memory cache for everyone.
  // For now the reset is per-tab/per-session.
  const [closedAt, setClosedAt] = useState<Date | null>(null);

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

  const [todayStr] = useState(getTodayIsoBolivia);

  const todayItems = useMemo(() => {
    const all =
      todayList.data?.items.filter((s) => {
        const itemLocal = new Date(new Date(s.createdAt).getTime() - 4 * 60 * 60 * 1000);
        return itemLocal.toISOString().slice(0, 10) === todayStr;
      }) ?? [];
    // Once the encargada cierra el día, the page should look "fresh" — hide the
    // sales that fell into the closed window. The data still lives in DailyReport
    // and the sales API; we only filter visually.
    if (!closedAt) return all;
    return all.filter((s) => new Date(s.createdAt) > closedAt);
  }, [todayList.data, todayStr, closedAt]);

  // Derive day stats. Encargada/admin uses the dashboard endpoint; vendedora
  // falls back to client-side aggregation of her own visible sales.
  // Count items (prendas), not transactions — the user wants the headline to
  // reflect "how many garments left the store today" not "how many tickets".
  const itemsSoldToday = useMemo(
    () => todayItems.reduce((sum, s) => sum + s.totalUnits, 0),
    [todayItems],
  );

  const stats = useMemo(() => {
    if (canSeeDashboard && dashboard.data) {
      const breakdown = dashboard.data.dailyBreakdown[0] ?? {
        cashCents: 0,
        qrCents: 0,
        cardCents: 0,
        totalCents: 0,
      };
      // dailyBreakdown[0] should be today; trust it.
      return {
        total: dashboard.data.todayCents,
        qr: breakdown.qrCents,
        cash: breakdown.cashCents,
        card: breakdown.cardCents,
        count: itemsSoldToday,
      };
    }
    let total = 0;
    let qr = 0;
    let cash = 0;
    let card = 0;
    for (const s of todayItems) {
      total += s.totalCents;
      if (s.paymentMethod === 'qr') qr += s.totalCents;
      else if (s.paymentMethod === 'cash') cash += s.totalCents;
      else if (s.paymentMethod === 'card') card += s.totalCents;
    }
    return { total, qr, cash, card, count: itemsSoldToday };
  }, [canSeeDashboard, dashboard.data, todayItems, itemsSoldToday]);

  const flatItems = useMemo(() => flattenSales(todayItems), [todayItems]);

  // En mobile mostramos solo 3 ítems por defecto + "Ver historial completo".
  // En md+ aprovechamos las 2 columnas del grid para mostrar 6 (3 filas) de
  // entrada — siguen ocultos en mobile vía hidden md:block.
  const previewCount = 3;
  const previewCountDesktop = 6;
  const visibleItemsDesktop = showAll ? flatItems : flatItems.slice(0, previewCountDesktop);

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      {/* max-w-4xl alinea el ancho con SedeInventoryPage / DeliveriesPage para
          que el layout en laptop sea consistente con el resto de la app. En
          mobile (< md) seguimos siendo full-width con padding de 16px. */}
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-3 md:gap-4 p-4 pb-24 md:pb-4 text-text-primary">
        {/* Header — Desktop keeps all actions inline; mobile moves high-frequency Scan to thumb-zone FAB */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary truncate">
              {store?.name ?? 'Registro de ventas'}
            </h1>
            <span className="shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-raised border border-surface-border text-text-secondary">
              Registro de ventas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<ScanLine className="h-4 w-4" />}
              onClick={() => setCashierOpen(true)}
              aria-label="Escanear venta"
              className="hidden md:inline-flex rounded-full bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] hover:opacity-90 border-0 shadow-xs"
            >
              Escanear venta
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5 text-status-warning" />}
              onClick={() => setReturnOpen(true)}
              aria-label="Registrar devolución"
              className="flex-1 md:flex-initial rounded-full"
            >
              Devolución
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCloseDayOpen(true)}
              className="flex-1 md:flex-initial rounded-full"
            >
              Cerrar día
            </Button>
          </div>
        </header>

        {/* En desktop ponemos el resumen del día y la lista lado a lado:
            resumen sticky a la izquierda (col-span-1), lista de ventas a la
            derecha (col-span-2). En mobile el grid colapsa a una columna. */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:gap-6 gap-4">
          {/* Day summary card */}
          <div className="md:col-span-1">
            <Card className="md:sticky md:top-4 rounded-[24px]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-muted font-semibold">Ventas del día</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E3F5EC] dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    En vivo
                  </span>
                </div>
                <p className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight font-tabular text-text-primary">
                  {formatBsBig(stats.total)}
                </p>
                <p className="mt-1 text-xs text-text-muted font-medium">
                  {stats.count} {stats.count === 1 ? 'prenda vendida' : 'prendas vendidas'}
                </p>

                <div className="mt-5 flex flex-col gap-2.5">
                  <PaymentRow label="QR" cents={stats.qr} totalCents={stats.total} />
                  <PaymentRow label="Efectivo" cents={stats.cash} totalCents={stats.total} />
                  <PaymentRow label="Tarjeta" cents={stats.card} totalCents={stats.total} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's sales list */}
          <section className="md:col-span-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Ventas de hoy</p>
            </div>

            {todayList.isLoading && <Skeleton className="h-16 w-full" />}
            {todayList.isError && <Alert variant="error">No pudimos cargar las ventas.</Alert>}
            {!todayList.isLoading && flatItems.length === 0 && (
              <p className="text-sm text-text-muted px-2">Sin ventas todavía hoy.</p>
            )}

            {/* Grid 1 col en mobile, 2 cols en md+ para aprovechar el ancho
                del laptop sin estirar individualmente cada card. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleItemsDesktop.map((row, idx) => (
                <div
                  key={row.itemId}
                  className={idx >= previewCount && !showAll ? 'hidden md:block' : ''}
                >
                  <ItemSaleCard row={row} index={idx} onImageClick={setZoomImage} />
                </div>
              ))}
            </div>

            {flatItems.length > previewCount && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  {showAll ? 'Ver menos' : 'Ver historial completo →'}
                </button>
              </div>
            )}
          </section>
        </div>

        <CashierModal
          storeId={storeId}
          open={cashierOpen}
          onClose={() => setCashierOpen(false)}
          onSold={(sale) => {
            setCashierOpen(false);
            setLastSale(sale);
          }}
        />

        <ReturnScannerModal
          storeId={storeId}
          open={returnOpen}
          onClose={() => setReturnOpen(false)}
        />

        <CloseDayModal
          storeId={storeId}
          open={closeDayOpen}
          onClose={() => setCloseDayOpen(false)}
          liveStats={stats}
          onClosedToday={() => {
            setClosedAt(new Date());
          }}
        />

        <Modal isOpen={zoomImage !== null} onClose={() => setZoomImage(null)} title="Producto">
          {zoomImage && (
            <img
              src={zoomImage}
              alt="Producto"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg bg-surface-sunken"
            />
          )}
        </Modal>

        <Modal
          isOpen={lastSale !== null}
          onClose={() => setLastSale(null)}
          title="Venta registrada"
        >
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="h-12 w-12 rounded-full bg-status-success-soft text-status-success flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-sm text-text-secondary text-center">
              {lastSale ? `Venta de ${formatBsBig(lastSale.totalCents)} registrada.` : ''}
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setLastSale(null)}
              className="w-full"
            >
              OK
            </Button>
          </div>
        </Modal>
      </main>

      {/* Mobile FAB Escanear venta (desktop uses inline header button) */}
      <div className="md:hidden fixed bottom-[88px] right-4 z-30">
        <button
          type="button"
          onClick={() => setCashierOpen(true)}
          className="h-13 w-13 rounded-full bg-[#111318] text-white dark:bg-[#e3ff6a] dark:text-[#111318] shadow-xl shadow-black/20 active:scale-95 transition-all flex items-center justify-center hover:scale-105"
          aria-label="Escanear venta"
        >
          <ScanLine className="h-6 w-6" />
        </button>
      </div>
    </AppShell>
  );
}
