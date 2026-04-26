import type { DailyReportDTO } from '@surmoda/contracts';
import { useDailyReportItems } from '../hooks/useDailyReports';
import { Alert, Modal, Skeleton } from '@/shared/ui';
import { formatBs } from '@/shared/format/currency';

interface DailyReportDetailModalProps {
  storeId: string;
  report: DailyReportDTO | null;
  onClose: () => void;
}

export function DailyReportDetailModal({ storeId, report, onClose }: DailyReportDetailModalProps) {
  const itemsQuery = useDailyReportItems(report ? storeId : undefined, report?.date);

  return (
    <Modal isOpen={Boolean(report)} onClose={onClose} title={report ? `Cierre ${report.date}` : ''}>
      {report && (
        <div className="flex flex-col gap-3">
          {/* Hero row: Total + Trans/Items full-width side by side. */}
          <ul className="grid grid-cols-2 gap-2 text-xs">
            <li className="rounded border border-surface-border px-3 py-2">
              <p className="text-slate-500">Total</p>
              <p className="font-mono font-semibold text-base mt-0.5">
                {formatBs(report.totalCents)}
              </p>
            </li>
            <li className="rounded border border-surface-border px-3 py-2">
              <p className="text-slate-500">Trans. / Ítems</p>
              <p className="font-mono font-semibold text-base mt-0.5">
                {report.transactionsCount} / {report.itemCount}
              </p>
            </li>
          </ul>

          {/* Payment-method row: each method gets its own card so the long
              numbers don't collide on mobile. The closer ("Cierre") was
              dropped from this grid — it lives in the modal title now. */}
          <ul className="grid grid-cols-3 gap-2 text-xs">
            <li className="rounded border border-surface-border px-2 py-1.5">
              <p className="text-slate-500">QR</p>
              <p className="font-mono">{formatBs(report.qrCents)}</p>
            </li>
            <li className="rounded border border-surface-border px-2 py-1.5">
              <p className="text-slate-500">Tarjeta</p>
              <p className="font-mono">{formatBs(report.cardCents)}</p>
            </li>
            <li className="rounded border border-surface-border px-2 py-1.5">
              <p className="text-slate-500">Efectivo</p>
              <p className="font-mono">{formatBs(report.cashCents)}</p>
            </li>
          </ul>

          <p className="text-[11px] text-slate-500">
            Cerrado por:{' '}
            <span className="font-medium text-slate-700">
              {report.autoClosed ? 'Auto-close' : (report.closedByFullName ?? 'Manual')}
            </span>
          </p>

          {report.attendees.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1">Atendieron ese día</p>
              <ul className="flex flex-wrap gap-1.5">
                {report.attendees.map((a, i) => (
                  <li
                    key={`${a.fullName}-${i}`}
                    className="rounded-full bg-violet-100 text-violet-700 text-xs px-2 py-0.5"
                  >
                    {a.fullName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-2">Productos vendidos</p>
            {itemsQuery.isLoading && <Skeleton className="h-24 w-full" />}
            {itemsQuery.isError && <Alert variant="error">No pudimos cargar el detalle.</Alert>}
            {itemsQuery.data && itemsQuery.data.items.length === 0 && (
              <p className="text-sm text-slate-500">Este día no tuvo ventas.</p>
            )}
            {itemsQuery.data && itemsQuery.data.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-sunken text-slate-600">
                    <tr>
                      <th className="text-left px-2 py-2">Producto</th>
                      <th className="text-left px-2 py-2">Talla / Color</th>
                      <th className="text-right px-2 py-2">Cant.</th>
                      <th className="text-right px-2 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsQuery.data.items.map((it) => (
                      <tr key={it.variantId} className="border-t border-surface-border">
                        <td className="px-2 py-2">
                          <p className="font-semibold">{it.productName}</p>
                          <p className="text-slate-500 font-mono text-[10px]">{it.productCode}</p>
                        </td>
                        <td className="px-2 py-2">
                          <span className="font-mono">{it.size}</span> · {it.color}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{it.quantity}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">
                          {formatBs(it.totalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
