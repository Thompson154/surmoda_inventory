import { useEffect, useMemo, useState } from 'react';
import type { DailyReportDTO } from '@surmoda/contracts';
import { Alert, Button, Modal, Skeleton } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { formatBs } from '@/shared/format/currency';
import type { HttpError } from '@/shared/services/httpClient';
import {
  useCloseToday,
  useDailyReportByDate,
  useStoreStaff,
} from '../hooks/useDailyReports';

interface CloseDayModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

function todayIsoBolivia(): string {
  const now = new Date();
  const local = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function CloseDayModal({ storeId, open, onClose }: CloseDayModalProps) {
  const today = useMemo(() => todayIsoBolivia(), []);
  const existing = useDailyReportByDate(open ? storeId : undefined, open ? today : undefined);
  const staff = useStoreStaff(open ? storeId : undefined);
  const closeMutation = useCloseToday(storeId);

  const [confirmed, setConfirmed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // When the modal opens (or the existing report loads with a roster), prefill
  // the checkbox set so the encargada starts from the previous list, not blank.
  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setSelected(new Set());
      closeMutation.reset();
      return;
    }
    if (existing.data) {
      setSelected(new Set(existing.data.attendees.map((a) => a.userId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing.data?.id]);

  const closedReport: DailyReportDTO | null = closeMutation.data ?? existing.data ?? null;
  const isAlreadyClosed = !confirmed && Boolean(existing.data);
  const errorMsg = useErrorMessage(closeMutation.error as HttpError | null);

  const toggle = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });

  const submit = () => {
    setConfirmed(true);
    closeMutation.mutate({ attendedUserIds: Array.from(selected) });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Cerrar día">
      <div className="flex flex-col gap-3">
        {existing.isLoading && <Skeleton className="h-16 w-full" />}

        {closedReport && (
          <>
            {isAlreadyClosed && (
              <Alert variant="info">
                Este día ya fue cerrado{closedReport.autoClosed ? ' automáticamente' : ''}.
                Volvé a cerrarlo solo si registraste ventas nuevas o necesitás corregir el
                personal del día.
              </Alert>
            )}
            {confirmed && closeMutation.isSuccess && (
              <Alert variant="success">Cierre registrado correctamente.</Alert>
            )}
            <ul className="rounded-lg border border-surface-border divide-y divide-surface-border text-sm">
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Total</span>
                <span className="font-mono font-semibold">{formatBs(closedReport.totalCents)}</span>
              </li>
              <li className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">Trans. / Ítems</span>
                <span className="font-mono">
                  {closedReport.transactionsCount} / {closedReport.itemCount}
                </span>
              </li>
            </ul>
          </>
        )}

        <div>
          <p className="text-sm font-semibold mb-1">Personal que atendió hoy</p>
          <p className="text-xs text-slate-500 mb-2">
            Marcá a quienes estuvieron en la sucursal — podés incluir ayudantes que no
            registraron ventas en su sesión.
          </p>
          {staff.isLoading && <Skeleton className="h-20 w-full" />}
          {staff.isError && (
            <Alert variant="error">No pudimos cargar el personal de la sede.</Alert>
          )}
          {staff.data && staff.data.items.length === 0 && (
            <p className="text-xs text-slate-500">Esta sede no tiene personal asignado.</p>
          )}
          {staff.data && staff.data.items.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {staff.data.items.map((s) => (
                <li key={s.userId}>
                  <label className="flex items-center gap-2 rounded border border-surface-border px-2 py-1.5 cursor-pointer hover:bg-surface-sunken">
                    <input
                      type="checkbox"
                      checked={selected.has(s.userId)}
                      onChange={() => toggle(s.userId)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm flex-1 truncate">{s.fullName}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {s.role}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

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
            onClick={submit}
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
