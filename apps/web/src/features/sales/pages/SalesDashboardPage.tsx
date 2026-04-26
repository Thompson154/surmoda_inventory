import { useMemo, useState } from 'react';
import type { DailyReportDTO } from '@surmoda/contracts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { DailyReportDetailModal } from '../components/DailyReportDetailModal';
import { useSalesDashboard } from '../hooks/useSales';
import { useDailyReports } from '../hooks/useDailyReports';
import { Alert, Card, CardContent, Skeleton } from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';
import { useStoreParam } from '@/shared/hooks/useStoreParam';
import { useStoreScope } from '@/shared/hooks/useStoreScope';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';
import { formatBs, formatBsShort } from '@/shared/format/currency';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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

function weekLabel(index: number): string {
  if (index === 0) return 'Esta semana';
  if (index === 1) return 'Semana pasada';
  return `Hace ${index} sem`;
}

function shortDate(iso: string): string {
  // iso = YYYY-MM-DD; render as "26 abr"
  const [, mm, dd] = iso.split('-');
  const m = MONTH_ABBR[Number(mm) - 1] ?? mm;
  return `${Number(dd)} ${m}`;
}

function weekRange(weekStartIso: string, weekEndIso: string): string {
  return `${shortDate(weekStartIso)} – ${shortDate(weekEndIso)}`;
}

interface SparklineProps {
  data: Array<{ date: string; totalCents: number }>;
}

function Sparkline({ data }: SparklineProps) {
  const width = 320;
  const height = 100;
  const padding = 12;
  const max = Math.max(1, ...data.map((d) => d.totalCents));

  const xStep = (width - padding * 2) / Math.max(1, data.length - 1);
  const yScale = (v: number) => height - padding - (v / max) * (height - padding * 2);

  const points = data.map((d, i) => ({
    x: padding + i * xStep,
    y: yScale(d.totalCents),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${points[points.length - 1]!.x} ${height - padding} L ${points[0]!.x} ${height - padding} Z`;

  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="sales-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sales-grad)" />
        <path
          d={path}
          fill="none"
          stroke="rgb(99 102 241)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Larger transparent hit-targets so the tooltip is easy to trigger on touch + mouse. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${i}`}
            x={p.x - xStep / 2}
            y={0}
            width={xStep}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            tabIndex={0}
            aria-label={`${data[i]!.date}: ${formatBs(data[i]!.totalCents)}`}
            style={{ cursor: 'pointer', outline: 'none' }}
          />
        ))}

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 5 : i === points.length - 1 ? 4 : 2.5}
            fill={hover === i || i === points.length - 1 ? 'rgb(99 102 241)' : 'white'}
            stroke="rgb(99 102 241)"
            strokeWidth={hover === i || i === points.length - 1 ? 0 : 1.5}
            pointerEvents="none"
          />
        ))}

        {data.map((d, i) => {
          const dt = new Date(`${d.date}T00:00:00`);
          const dayLabel = DAY_LABELS[dt.getDay()];
          return (
            <text
              key={d.date}
              x={padding + i * xStep}
              y={height + 16}
              textAnchor="middle"
              className="fill-slate-500"
              style={{ fontSize: 10 }}
            >
              {dayLabel}
            </text>
          );
        })}

        {hover !== null &&
          (() => {
            const p = points[hover]!;
            const d = data[hover]!;
            const label = `${shortDate(d.date)} · ${formatBs(d.totalCents)}`;
            // Approximate width based on char count so the box stays inside the SVG.
            const w = Math.max(96, label.length * 6.5);
            const x = Math.min(Math.max(p.x - w / 2, padding), width - padding - w);
            const y = Math.max(p.y - 32, 4);
            return (
              <g pointerEvents="none">
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={22}
                  rx={4}
                  fill="rgb(15 23 42)"
                  opacity={0.92}
                />
                <text
                  x={x + w / 2}
                  y={y + 14}
                  textAnchor="middle"
                  fill="white"
                  style={{ fontSize: 10, fontWeight: 500 }}
                >
                  {label}
                </text>
              </g>
            );
          })()}
      </svg>
    </div>
  );
}

export function SalesDashboardPage() {
  const storeId = useStoreParam() ?? '';
  const stores = useStores();
  const store = stores.data?.items.find((s) => s.id === storeId);
  const isWarehouse = store?.kind === 'warehouse';
  const { isVendedoraHere } = useStoreScope(storeId);

  const dashboard = useSalesDashboard(storeId);
  const closures = useDailyReports(storeId, { page: 1, pageSize: 10 });
  const [selectedReport, setSelectedReport] = useState<DailyReportDTO | null>(null);
  const [weekPopover, setWeekPopover] = useState<number | null>(null);

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
        <header>
          <h1 className="text-xl font-semibold">Ventas</h1>
        </header>

        {dashboard.isLoading && (
          <>
            <Skeleton className="h-40 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </>
        )}

        {dashboard.isError && <Alert variant="error">No pudimos cargar el dashboard.</Alert>}

        {dashboard.data && (
          <>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Ventas hoy</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {formatBsShort(dashboard.data.todayCents)}
                  </span>
                  {dashboard.data.deltaPct !== null && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        dashboard.data.deltaPct >= 0
                          ? 'bg-status-success-soft text-status-success'
                          : 'bg-status-danger-soft text-status-danger'
                      }`}
                    >
                      {dashboard.data.deltaPct >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {dashboard.data.deltaPct.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  vs {formatBsShort(dashboard.data.yesterdayCents)} ayer
                </p>
                <Sparkline data={dashboard.data.last7Days} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-slate-500">Total semana</p>
                  <p className="text-base font-semibold mt-1">
                    {formatBsShort(dashboard.data.weekCents)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">7 días</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-slate-500">Transacciones</p>
                  <p className="text-base font-semibold mt-1">{dashboard.data.transactionsCount}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">completadas</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent>
                <p className="text-sm font-semibold mb-2">Resumen semanal (últimas 5 semanas)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-sunken text-slate-600">
                      <tr>
                        <th className="text-left px-2 py-2">Semana</th>
                        <th className="text-right px-2 py-2">QR</th>
                        <th className="text-right px-2 py-2">Tarjeta</th>
                        <th className="text-right px-2 py-2">Efectivo</th>
                        <th className="text-right px-2 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.data.weeklyBreakdown.map((row, idx) => (
                        <tr key={row.weekStart} className="border-t border-surface-border">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setWeekPopover(weekPopover === idx ? null : idx)}
                              className="font-semibold text-left hover:text-brand-strong"
                              aria-label={`Ver rango de fechas de ${weekLabel(idx)}`}
                            >
                              {weekLabel(idx)}
                            </button>
                            {weekPopover === idx && (
                              <div className="mt-1 inline-block rounded-md bg-slate-900 text-white text-[10px] font-mono px-2 py-1 shadow">
                                {weekRange(row.weekStart, row.weekEnd)}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatBs(row.qrCents)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatBs(row.cardCents)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatBs(row.cashCents)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-semibold">
                            {formatBs(row.totalCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-sm font-semibold mb-2">Historial de cierres diarios</p>
                {closures.isLoading && <Skeleton className="h-16 w-full" />}
                {closures.isError && <Alert variant="error">No pudimos cargar el historial.</Alert>}
                {closures.data && closures.data.items.length === 0 && (
                  <p className="text-sm text-slate-500">Aún no hay cierres registrados.</p>
                )}
                {closures.data && closures.data.items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-sunken text-slate-600">
                        <tr>
                          <th className="text-left px-2 py-2">Fecha</th>
                          <th className="text-right px-2 py-2">Ítems</th>
                          <th className="text-right px-2 py-2">Total</th>
                          <th className="text-left px-2 py-2">Cierre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closures.data.items.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-surface-border cursor-pointer hover:bg-surface-sunken"
                            onClick={() => setSelectedReport(row)}
                          >
                            <td className="px-2 py-2 font-mono text-brand-strong underline-offset-2 hover:underline">
                              {row.date}
                            </td>
                            <td className="px-2 py-2 text-right">{row.itemCount}</td>
                            <td className="px-2 py-2 text-right font-mono font-semibold">
                              {formatBs(row.totalCents)}
                            </td>
                            <td className="px-2 py-2">
                              {row.autoClosed ? (
                                <span className="rounded bg-amber-100 text-amber-700 px-1.5 py-0.5">
                                  Auto
                                </span>
                              ) : (
                                <span className="rounded bg-emerald-100 text-emerald-700 px-1.5 py-0.5">
                                  {row.closedByFullName ?? 'Manual'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <DailyReportDetailModal
          storeId={storeId}
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      </main>
    </AppShell>
  );
}
