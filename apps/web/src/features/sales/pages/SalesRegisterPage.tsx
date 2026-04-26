import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ScanLine } from 'lucide-react';
import type { SaleWithItems } from '@surmoda/contracts';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Modal,
  Skeleton,
} from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useSales, useSalesDashboard } from '../hooks/useSales';
import { CashierModal } from '../components/CashierModal';
import { CloseDayModal } from '../components/CloseDayModal';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';

function formatBs(cents: number): string {
  return `Bs. ${(cents / 100).toFixed(2)}`;
}

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  // Dashboard is gated server-side (vendedora gets 403). Only request it when allowed.
  const dashboard = useSalesDashboard(canSeeDashboard ? storeId : undefined);

  const [cashierOpen, setCashierOpen] = useState(false);
  const [closeDayOpen, setCloseDayOpen] = useState(false);
  const [lastSale, setLastSale] = useState<SaleWithItems | null>(null);

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

  // Vendedora doesn't get dashboard data — fall back to the cashier-side breakdown
  // computed from the day's sales list.
  const fallback = useMemo(() => {
    if (!todayList.data) return { total: 0, cash: 0, qr: 0, card: 0 };
    const todayStr = new Date().toISOString().slice(0, 10);
    let total = 0;
    let cash = 0;
    let qr = 0;
    let card = 0;
    for (const s of todayList.data.items) {
      if (!s.createdAt.startsWith(todayStr)) continue;
      total += s.totalCents;
      if (s.paymentMethod === 'cash') cash += s.totalCents;
      else if (s.paymentMethod === 'qr') qr += s.totalCents;
      else if (s.paymentMethod === 'card') card += s.totalCents;
    }
    return { total, cash, qr, card };
  }, [todayList.data]);

  const todayStats =
    canSeeDashboard && dashboard.data
      ? {
          total: dashboard.data.todayCents,
          cash: dashboard.data.dailyBreakdown[0]?.cashCents ?? 0,
          qr: dashboard.data.dailyBreakdown[0]?.qrCents ?? 0,
          card: dashboard.data.dailyBreakdown[0]?.cardCents ?? 0,
        }
      : fallback;

  const todayItems =
    todayList.data?.items.filter((s) =>
      s.createdAt.startsWith(new Date().toISOString().slice(0, 10)),
    ) ?? [];

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-semibold">Ventas del día</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCloseDayOpen(true)}
            >
              Cerrar día
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<ScanLine className="h-4 w-4" />}
              onClick={() => setCashierOpen(true)}
            >
              Vender
            </Button>
          </div>
        </header>

        <Card>
          <CardContent className="grid grid-cols-2 gap-2 py-3 text-sm">
            <Stat label="Total" value={formatBs(todayStats.total)} />
            <Stat label="QR" value={formatBs(todayStats.qr)} />
            <Stat label="Efectivo" value={formatBs(todayStats.cash)} />
            <Stat label="Tarjeta" value={formatBs(todayStats.card)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-sunken text-slate-600">
                <tr>
                  <th className="text-left px-2 py-2">Hora</th>
                  <th className="text-left px-2 py-2">Vendedora</th>
                  <th className="text-right px-2 py-2">Items</th>
                  <th className="text-right px-2 py-2">Pago</th>
                  <th className="text-right px-2 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {todayList.isLoading && (
                  <tr>
                    <td colSpan={5} className="p-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                )}
                {todayList.isError && (
                  <tr>
                    <td colSpan={5} className="p-3">
                      <Alert variant="error">No pudimos cargar las ventas.</Alert>
                    </td>
                  </tr>
                )}
                {todayItems.length === 0 && !todayList.isLoading && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      Sin ventas todavía hoy.
                    </td>
                  </tr>
                )}
                {todayItems.map((s) => (
                  <tr key={s.id} className="border-t border-surface-border">
                    <td className="px-2 py-2 font-mono">{timeOfDay(s.createdAt)}</td>
                    <td className="px-2 py-2 truncate">{s.recordedByFullName}</td>
                    <td className="px-2 py-2 text-right">{s.totalUnits}</td>
                    <td className="px-2 py-2 text-right uppercase text-slate-500">
                      {s.paymentMethod}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-semibold">
                      {formatBs(s.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

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
          isOpen={lastSale !== null}
          onClose={() => setLastSale(null)}
          title="Venta registrada"
        >
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="h-12 w-12 rounded-full bg-status-success-soft text-status-success flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-sm text-slate-700 text-center">
              {lastSale ? `Venta de ${formatBs(lastSale.totalCents)} registrada.` : ''}
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

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-surface-border px-2 py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-mono font-semibold text-slate-900">{value}</span>
    </div>
  );
}
