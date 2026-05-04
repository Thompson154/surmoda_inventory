// Modal de vista previa del reporte de ventas.
// Muestra resumen en cards, tabla (primeras 50 filas), inventario opcional,
// y botón para descargar el Excel completo.

import { X, Download, Banknote, CreditCard, QrCode } from 'lucide-react';
import { useDownloadXlsx } from '../hooks/useGenerateReport';
import type { SalesReportPreview, GenerateReportArgs } from '../types';
import { cn } from '@/shared/ui/cn';
import { Button } from '@/shared/ui';
import { formatBsExact } from '@/shared/format/currency';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDatetime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:mm:ss → dd/mm/yyyy HH:mm
  const [y, m, d] = date.split('-');
  const hhmm = time.slice(0, 5);
  return `${d}/${m}/${y} ${hhmm}`;
}

const PREVIEW_LIMIT = 50;

// ─── Component ────────────────────────────────────────────────────────────────

export interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: SalesReportPreview;
  downloadArgs?: GenerateReportArgs;
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  preview,
  downloadArgs,
}: ReportPreviewModalProps) {
  const download = useDownloadXlsx();

  if (!isOpen) return null;

  const { store, period, sales, paymentSummary, inventory } = preview;
  const shownRows = sales.rows.slice(0, PREVIEW_LIMIT);
  const hasMore = sales.totalRows > PREVIEW_LIMIT;

  // Build args for download (use stored args or reconstruct from preview)
  const xlsxArgs: GenerateReportArgs = downloadArgs ?? {
    storeId: store.id,
    from: period.from,
    to: period.to,
    includePaymentSummary: !!paymentSummary,
    includeInventory: !!inventory,
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 px-4',
        'bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto',
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reporte de Ventas — ${store.name}`}
        className={cn(
          'relative z-10 bg-surface-raised supports-[backdrop-filter]:bg-glass-elevated backdrop-blur-md',
          'border border-glass-border rounded-xl shadow-2xl animate-scale-in',
          'w-full max-w-4xl my-auto',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-surface-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Reporte de Ventas — {store.name}
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Periodo: <span className="font-mono">{period.from}</span> al{' '}
              <span className="font-mono">{period.to}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className={cn(
              'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
              'text-text-subtle hover:text-text-secondary hover:bg-surface-sunken',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SummaryCard
              label="Total ventas"
              value={formatBsExact(sales.totalAmountCents)}
              highlighted
            />
            <SummaryCard label="Total registros" value={sales.totalRows.toLocaleString('es-BO')} />
            {paymentSummary && (
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">
                  Pagos por método
                </p>
                <div className="flex flex-col gap-1">
                  <PaymentMethodRow
                    icon={<Banknote className="h-3.5 w-3.5" />}
                    label="Efectivo"
                    cents={paymentSummary.cash}
                  />
                  <PaymentMethodRow
                    icon={<CreditCard className="h-3.5 w-3.5" />}
                    label="Tarjeta"
                    cents={paymentSummary.card}
                  />
                  <PaymentMethodRow
                    icon={<QrCode className="h-3.5 w-3.5" />}
                    label="QR"
                    cents={paymentSummary.qr}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sales table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text-primary">Vista previa de ventas</p>
              {hasMore && (
                <span className="text-xs text-text-muted">
                  Mostrando {PREVIEW_LIMIT} de {sales.totalRows} ventas. Descargá el Excel para ver
                  todas.
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-surface-border">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs min-w-[800px]">
                  <thead className="bg-surface-sunken text-text-secondary sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Fecha</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Ticket</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Producto</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Color</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Talla</th>
                      <th className="text-right px-2 py-2 whitespace-nowrap">Cant.</th>
                      <th className="text-right px-2 py-2 whitespace-nowrap">Precio</th>
                      <th className="text-right px-2 py-2 whitespace-nowrap">Subtotal</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Pago</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Vendedora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((row, i) => (
                      <tr
                        key={`${row.ticketNumber}-${i}`}
                        className="border-t border-surface-border hover:bg-surface-sunken/50"
                      >
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                          {formatDatetime(row.saleDate, row.saleTime)}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-text-muted whitespace-nowrap">
                          {row.ticketNumber.slice(-8)}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="font-semibold">{row.productCode}</span>{' '}
                          <span className="text-text-muted">{row.variantDescription}</span>
                        </td>
                        <td className="px-2 py-1.5 capitalize">{row.color}</td>
                        <td className="px-2 py-1.5">{row.size}</td>
                        <td className="px-2 py-1.5 text-right">{row.quantity}</td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {formatBsExact(row.unitPriceCents)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">
                          {formatBsExact(row.subtotalCents)}
                        </td>
                        <td className="px-2 py-1.5 capitalize">{row.paymentMethod}</td>
                        <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">
                          {row.cashier}
                        </td>
                      </tr>
                    ))}
                    {shownRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-6 text-center text-text-muted">
                          Sin ventas en el periodo seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Inventory section */}
          {inventory && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-text-primary">Inventario actual</p>
                <span className="text-xs text-text-muted font-mono">
                  Capturado: {new Date(inventory.capturedAt).toLocaleString('es-BO')}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-surface-border">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead className="bg-surface-sunken text-text-secondary sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-2">Código</th>
                        <th className="text-left px-2 py-2">Variante</th>
                        <th className="text-left px-2 py-2">Color</th>
                        <th className="text-left px-2 py-2">Talla</th>
                        <th className="text-right px-2 py-2">Cant.</th>
                        <th className="text-right px-2 py-2">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.rows.map((row, i) => (
                        <tr
                          key={`${row.productCode}-${i}`}
                          className="border-t border-surface-border"
                        >
                          <td className="px-2 py-1.5 font-mono font-semibold">{row.productCode}</td>
                          <td className="px-2 py-1.5 text-text-muted">{row.variantDescription}</td>
                          <td className="px-2 py-1.5 capitalize">{row.color}</td>
                          <td className="px-2 py-1.5">{row.size}</td>
                          <td className="px-2 py-1.5 text-right">{row.quantity}</td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {formatBsExact(row.unitPriceCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-1">
                {inventory.totalVariants} variantes · {inventory.totalUnits} unidades totales
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-surface-border">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            leftIcon={<Download className="h-4 w-4" />}
            isLoading={download.isPending}
            onClick={() => download.mutate(xlsxArgs)}
          >
            {download.isPending ? 'Descargando...' : 'Descargar Excel completo'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        highlighted
          ? 'border-brand-primary/30 bg-brand-primary/5'
          : 'border-surface-border bg-surface-base',
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-bold font-mono',
          highlighted ? 'text-brand-primary' : 'text-text-primary',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PaymentMethodRow({
  icon,
  label,
  cents,
}: {
  icon: React.ReactNode;
  label: string;
  cents: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text-muted">{icon}</span>
      <span className="text-text-secondary flex-1">{label}</span>
      <span className="font-mono font-semibold text-text-primary">{formatBsExact(cents)}</span>
    </div>
  );
}
