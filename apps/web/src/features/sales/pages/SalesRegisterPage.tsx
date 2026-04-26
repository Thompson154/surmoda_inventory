import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Banknote, Check, ChevronRight, CreditCard, QrCode, ScanLine } from 'lucide-react';
import type { SaleItemDTO, SaleWithItems } from '@surmoda/contracts';
import { Alert, Button, Card, CardContent, Modal, Skeleton } from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useSales, useSalesDashboard } from '../hooks/useSales';
import { CashierModal } from '../components/CashierModal';
import { CloseDayModal } from '../components/CloseDayModal';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';
import { formatBsBig, formatBsShort } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';
import { resolveImageUrl } from '@/shared/format/imageUrl';

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
    QR: { bg: 'bg-violet-100', text: 'text-violet-600', bar: 'bg-violet-500', Icon: QrCode },
    Efectivo: { bg: 'bg-emerald-100', text: 'text-emerald-600', bar: 'bg-emerald-500', Icon: Banknote },
    Tarjeta: { bg: 'bg-slate-200', text: 'text-slate-700', bar: 'bg-slate-700', Icon: CreditCard },
  }[label];
  const { Icon } = palette;
  return (
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg ${palette.bg} ${palette.text} flex items-center justify-center shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">{label}</span>
          <span className="text-slate-500 font-mono">
            {formatBsShort(cents)} · {pct}%
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${palette.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

interface ItemSaleCardProps {
  row: FlatItemRow;
  onImageClick: (src: string) => void;
}

function ItemSaleCard({ row, onImageClick }: ItemSaleCardProps) {
  const palette =
    row.paymentMethod === 'qr'
      ? { bg: 'bg-violet-100', text: 'text-violet-600', Icon: QrCode }
      : row.paymentMethod === 'cash'
        ? { bg: 'bg-emerald-100', text: 'text-emerald-600', Icon: Banknote }
        : { bg: 'bg-slate-200', text: 'text-slate-700', Icon: CreditCard };
  const { Icon } = palette;
  const src = resolveImageUrl(row.imagePath);
  const showDiscount = row.subtotalCents !== row.catalogTotalCents;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-white px-3 py-2.5">
      {src ? (
        <button
          type="button"
          onClick={() => onImageClick(src)}
          className="h-12 w-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 focus:outline focus:outline-brand"
          aria-label="Ver imagen del producto"
        >
          <img src={src} alt={row.productName} className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className={`h-12 w-12 rounded-lg ${palette.bg} ${palette.text} flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {row.productCode} · <span className="capitalize">{row.color}</span> · {row.size}
        </p>
        <p className="text-xs text-slate-500">
          {timeOfDay(row.createdAt)} · {row.quantity} {row.quantity === 1 ? 'unidad' : 'unidades'}
        </p>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <div className={`h-5 w-5 rounded ${palette.bg} ${palette.text} flex items-center justify-center mb-0.5`}>
          <Icon className="h-3 w-3" />
        </div>
        {showDiscount && (
          <p className="text-[10px] text-slate-400 font-mono line-through">
            {formatBsBig(row.catalogTotalCents)}
          </p>
        )}
        <p className="text-sm font-mono font-semibold text-slate-900">
          {formatBsBig(row.subtotalCents)}
        </p>
      </div>
    </div>
  );
}

export function SalesRegisterPage() {
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
  const canSeeDashboard = isAdmin || hasEncargadaRole;

  const todayList = useSales(storeId, { page: 1, pageSize: 50 });
  const dashboard = useSalesDashboard(canSeeDashboard ? storeId : undefined);

  const [cashierOpen, setCashierOpen] = useState(false);
  const [closeDayOpen, setCloseDayOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lastSale, setLastSale] = useState<SaleWithItems | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

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

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayItems = useMemo(
    () => todayList.data?.items.filter((s) => s.createdAt.startsWith(todayStr)) ?? [],
    [todayList.data, todayStr],
  );

  // Derive day stats. Encargada/admin uses the dashboard endpoint; vendedora
  // falls back to client-side aggregation of her own visible sales.
  const stats = useMemo(() => {
    if (canSeeDashboard && dashboard.data) {
      const breakdown = dashboard.data.dailyBreakdown[0] ?? {
        cashCents: 0, qrCents: 0, cardCents: 0, totalCents: 0,
      };
      // dailyBreakdown[0] should be today; trust it.
      return {
        total: dashboard.data.todayCents,
        qr: breakdown.qrCents,
        cash: breakdown.cashCents,
        card: breakdown.cardCents,
        count: todayItems.length,
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
    return { total, qr, cash, card, count: todayItems.length };
  }, [canSeeDashboard, dashboard.data, todayItems]);

  const flatItems = useMemo(() => flattenSales(todayItems), [todayItems]);
  const visibleItems = showAll ? flatItems : flatItems.slice(0, 3);

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 text-slate-900">
        {/* Header — Cerrar día button */}
        <header className="flex items-center justify-between">
          <h1 className="text-base font-semibold">{store?.name ?? 'Ventas'}</h1>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCloseDayOpen(true)}
          >
            Cerrar día
          </Button>
        </header>

        {/* Day summary card */}
        <Card>
          <CardContent className="py-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Ventas del día
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{formatBsBig(stats.total)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {stats.count} {stats.count === 1 ? 'transacción' : 'transacciones'}
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <PaymentRow label="QR" cents={stats.qr} totalCents={stats.total} />
              <PaymentRow label="Efectivo" cents={stats.cash} totalCents={stats.total} />
              <PaymentRow label="Tarjeta" cents={stats.card} totalCents={stats.total} />
            </div>
          </CardContent>
        </Card>

        {/* Big violet "Escanear venta" CTA */}
        <button
          type="button"
          onClick={() => setCashierOpen(true)}
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-4 shadow-md hover:shadow-lg active:scale-[0.99] transition"
        >
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <ScanLine className="h-6 w-6" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold">Escanear venta</p>
            <p className="text-xs text-white/80">Apuntá al código de barras del producto</p>
          </div>
          <ChevronRight className="h-5 w-5 opacity-80 shrink-0" />
        </button>

        {/* Today's sales list */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Ventas de hoy</p>
          </div>

          {todayList.isLoading && <Skeleton className="h-16 w-full" />}
          {todayList.isError && <Alert variant="error">No pudimos cargar las ventas.</Alert>}
          {!todayList.isLoading && flatItems.length === 0 && (
            <p className="text-sm text-slate-500 px-2">Sin ventas todavía hoy.</p>
          )}

          <div className="flex flex-col gap-2">
            {visibleItems.map((row) => (
              <ItemSaleCard
                key={row.itemId}
                row={row}
                onImageClick={setZoomImage}
              />
            ))}
          </div>

          {flatItems.length > 3 && (
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

        <CashierModal
          storeId={storeId}
          open={cashierOpen}
          onClose={() => setCashierOpen(false)}
          onSold={(sale) => {
            setCashierOpen(false);
            setLastSale(sale);
          }}
        />

        <CloseDayModal
          storeId={storeId}
          open={closeDayOpen}
          onClose={() => setCloseDayOpen(false)}
        />

        <Modal
          isOpen={zoomImage !== null}
          onClose={() => setZoomImage(null)}
          title="Producto"
        >
          {zoomImage && (
            <img
              src={zoomImage}
              alt="Producto"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg bg-slate-100"
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
            <p className="text-sm text-slate-700 text-center">
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
    </AppShell>
  );
}
