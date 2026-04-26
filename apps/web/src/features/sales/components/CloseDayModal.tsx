import { useEffect, useMemo, useState } from 'react';
import type { DailyReportDTO } from '@surmoda/contracts';
import { Alert, Button, Modal, Skeleton } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useCloseToday, useDailyReportByDate } from '../hooks/useDailyReports';

interface CloseDayModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

function formatBs(cents: number): string {
  return `Bs. ${(cents / 100).toFixed(2)}`;
}

function todayIsoBolivia(): string {
  const now = new Date();
  const local = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function CloseDayModal({ storeId, open, onClose }: CloseDayModalProps) {
  const today = useMemo(() => todayIsoBolivia(), []);
  const existing = useDailyReportByDate(open ? storeId : undefined, open ? today : undefined);
  const closeMutation = useCloseToday(storeId);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      closeMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closedReport: DailyReportDTO | null =
    closeMutation.data ?? (existing.data ?? null);
  const isAlreadyClosed = !confirmed && Boolean(existing.data);
  const errorMsg = useErrorMessage(closeMutation.error as HttpError | null);

  return (
    <Modal isOpen={open} onClose={onClose} title="Cerrar día">
      <div className="flex flex-col gap-3">
        {existing.isLoading && <Skeleton className="h-16 w-full" />}

        {closedReport && (
          <>
            {isAlreadyClosed && (
              <Alert variant="info">
                Este día ya fue cerrado{closedReport.autoClosed ? ' automáticamente' : ''}.
                Volvé a cerrarlo solo si registraste ventas nuevas.
              </Alert>
            )}
            {confirmed && closeMutation.isSuccess && (
              <Alert variant="success">
                Cierre registrado correctamente.
              </Alert>
            )}
            <ul className="rounded-lg border border-surface-border divide-y divide-surface-border text-sm">
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Fecha</span>
                <span className="font-mono">{closedReport.date}</span>
              </li>
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Transacciones</span>
                <span className="font-mono">{closedReport.transactionsCount}</span>
              </li>
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Ítems</span>
                <span className="font-mono">{closedReport.itemCount}</span>
              </li>
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Total</span>
                <span className="font-mono font-semibold">{formatBs(closedReport.totalCents)}</span>
              </li>
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Efectivo</span>
                <span className="font-mono">{formatBs(closedReport.cashCents)}</span>
              </li>
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">QR</span>
                <span className="font-mono">{formatBs(closedReport.qrCents)}</span>
              </li>
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Tarjeta</span>
                <span className="font-mono">{formatBs(closedReport.cardCents)}</span>
              </li>
            </ul>
          </>
        )}

        {!existing.isLoading && !closedReport && (
          <p className="text-sm text-slate-600">
            Vas a cerrar el día y generar el reporte inmutable. Las ventas posteriores quedan
            fuera del cierre.
          </p>
        )}

        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={closeMutation.isPending || existing.isLoading}
            onClick={() => {
              setConfirmed(true);
              closeMutation.mutate();
            }}
          >
            {closeMutation.isPending
              ? 'Cerrando…'
              : closedReport
                ? 'Volver a cerrar'
                : 'Confirmar cierre'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
