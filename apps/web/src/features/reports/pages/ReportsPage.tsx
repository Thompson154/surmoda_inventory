import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Banknote, CreditCard, QrCode, TrendingUp } from 'lucide-react';
import { useReportSummary } from '../hooks/useReports';
import { Alert, Card, CardContent, Input, Skeleton } from '@/shared/ui';
import { AppShell } from '@/shared/layout/AppShell';
import { formatBs, formatBsShort } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

type Preset = 'today' | '7d' | '30d' | 'custom';

function todayBoliviaIso(): string {
  const local = new Date(new Date().getTime() - 4 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function ReportsPage() {
  const today = useMemo(() => todayBoliviaIso(), []);
  const [preset, setPreset] = useState<Preset>('7d');
  const [customFrom, setCustomFrom] = useState(shiftIso(today, -6));
  const [customTo, setCustomTo] = useState(today);

  const range = useMemo(() => {
    if (preset === 'today') return { from: today, to: today };
    if (preset === '7d') return { from: shiftIso(today, -6), to: today };
    if (preset === '30d') return { from: shiftIso(today, -29), to: today };
    return { from: customFrom, to: customTo };
  }, [preset, today, customFrom, customTo]);

  const summary = useReportSummary(range);
  const data = summary.data;
  // Admins land here from /admin; encargadas land from /sedes. Send each one
  // back to where they came from rather than dumping encargadas on a 403 page.
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false);
  const backTo = isAdmin ? '/admin' : '/sedes';
  const backLabel = isAdmin ? 'Volver al panel admin' : 'Volver a sucursales';

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Link
              to={backTo}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
            <h1 className="text-xl font-semibold">Reportes</h1>
            <p className="text-xs text-slate-500">Análisis cross-sucursal — admin / encargada</p>
          </div>
        </header>

        {/* Range presets + custom */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            {[
              { v: 'today' as Preset, label: 'Hoy' },
              { v: '7d' as Preset, label: '7 días' },
              { v: '30d' as Preset, label: '30 días' },
              { v: 'custom' as Preset, label: 'Personalizado' },
            ].map((p) => {
              const active = preset === p.v;
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPreset(p.v)}
                  className={
                    active
                      ? 'rounded-full bg-slate-900 text-white text-xs font-semibold px-3 py-1.5'
                      : 'rounded-full border border-surface-border bg-white text-slate-600 text-xs px-3 py-1.5 hover:bg-surface-sunken'
                  }
                >
                  {p.label}
                </button>
              );
            })}

            {preset === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <Input
                  id="reports-from"
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs"
                />
                <span className="text-xs text-slate-400">→</span>
                <Input
                  id="reports-to"
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}

            <span className="ml-auto text-xs text-slate-500 font-mono">
              {range.from} → {range.to}
            </span>
          </CardContent>
        </Card>

        {summary.isError && <Alert variant="error">No pudimos cargar el reporte.</Alert>}

        {/* Totals — hero */}
        <Card>
          <CardContent className="py-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Ventas totales del rango
            </p>
            {summary.isLoading || !data ? (
              <Skeleton className="h-10 w-48 mt-2" />
            ) : (
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {formatBs(data.totals.totalCents)}
              </p>
            )}
            {data && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Transacciones"
                  value={data.totals.transactionsCount.toLocaleString('es-BO')}
                />
                <Stat label="Ítems" value={data.totals.itemCount.toLocaleString('es-BO')} />
                <Stat label="Descuentos" value={formatBs(data.totals.discountCents)} />
                <Stat label="Sucursales activas" value={data.byStore.length.toString()} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment-method breakdown */}
        {data && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm font-semibold mb-3">Distribución por método de pago</p>
              <div className="flex flex-col gap-3">
                <PaymentBar
                  Icon={QrCode}
                  label="QR"
                  cents={data.totals.qrCents}
                  totalCents={data.totals.totalCents}
                  palette={{ bg: 'bg-violet-100', text: 'text-violet-600', bar: 'bg-violet-500' }}
                />
                <PaymentBar
                  Icon={Banknote}
                  label="Efectivo"
                  cents={data.totals.cashCents}
                  totalCents={data.totals.totalCents}
                  palette={{
                    bg: 'bg-emerald-100',
                    text: 'text-emerald-600',
                    bar: 'bg-emerald-500',
                  }}
                />
                <PaymentBar
                  Icon={CreditCard}
                  label="Tarjeta"
                  cents={data.totals.cardCents}
                  totalCents={data.totals.totalCents}
                  palette={{ bg: 'bg-slate-200', text: 'text-slate-700', bar: 'bg-slate-700' }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* By store */}
        {data && (
          <Card>
            <CardContent>
              <p className="text-sm font-semibold mb-2">Comparativa por sucursal</p>
              {data.byStore.length === 0 ? (
                <p className="text-sm text-slate-500">Sin ventas en el rango.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-sunken text-slate-600">
                      <tr>
                        <th className="text-left px-2 py-2">Sucursal</th>
                        <th className="text-right px-2 py-2">Trans.</th>
                        <th className="text-right px-2 py-2">Total</th>
                        <th className="text-left px-2 py-2 w-[40%]">Participación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byStore.map((row) => {
                        const share = pct(row.totalCents, data.totals.totalCents);
                        return (
                          <tr key={row.storeId} className="border-t border-surface-border">
                            <td className="px-2 py-2">
                              <p className="font-semibold">{row.storeName}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                {row.storeCode}
                              </p>
                            </td>
                            <td className="px-2 py-2 text-right">{row.transactionsCount}</td>
                            <td className="px-2 py-2 text-right font-mono font-semibold">
                              {formatBs(row.totalCents)}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500"
                                    style={{ width: `${share}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono w-9 text-right">
                                  {share}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Top products */}
        {data && (
          <Card>
            <CardContent>
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Top 10 productos vendidos
              </p>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-slate-500">Sin ventas en el rango.</p>
              ) : (
                <ol className="flex flex-col gap-1.5">
                  {data.topProducts.map((p, i) => (
                    <li
                      key={p.variantId}
                      className="flex items-center gap-3 rounded border border-surface-border bg-white px-3 py-2"
                    >
                      <span className="text-xs font-mono w-5 text-slate-400">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {p.productCode} · {sizeLabel(p.size)} ·{' '}
                          <span className="capitalize">{p.color}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{p.productName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-semibold">
                          {formatBsShort(p.totalCents)}
                        </p>
                        <p className="text-[10px] text-slate-500">{p.quantitySold} u.</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {/* Top sellers */}
        {data && (
          <Card>
            <CardContent>
              <p className="text-sm font-semibold mb-2">Top 5 vendedoras</p>
              {data.topSellers.length === 0 ? (
                <p className="text-sm text-slate-500">Sin ventas en el rango.</p>
              ) : (
                <ol className="flex flex-col gap-1.5">
                  {data.topSellers.map((s, i) => (
                    <li
                      key={s.userId}
                      className="flex items-center gap-3 rounded border border-surface-border bg-white px-3 py-2"
                    >
                      <span className="text-xs font-mono w-5 text-slate-400">#{i + 1}</span>
                      <p className="flex-1 text-sm font-semibold truncate">{s.fullName}</p>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-semibold">
                          {formatBsShort(s.totalCents)}
                        </p>
                        <p className="text-[10px] text-slate-500">{s.transactionsCount} transac.</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}
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
    <div className="flex flex-col rounded border border-surface-border px-2 py-1.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

interface PaymentBarProps {
  Icon: typeof QrCode;
  label: string;
  cents: number;
  totalCents: number;
  palette: { bg: string; text: string; bar: string };
}

function PaymentBar({ Icon, label, cents, totalCents, palette }: PaymentBarProps) {
  const share = pct(cents, totalCents);
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-9 w-9 rounded-lg ${palette.bg} ${palette.text} flex items-center justify-center shrink-0`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">{label}</span>
          <span className="text-slate-500 font-mono">
            {formatBs(cents)} · {share}%
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${palette.bar}`} style={{ width: `${share}%` }} />
        </div>
      </div>
    </div>
  );
}
