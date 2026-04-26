import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { DailyReportDTO } from '@surmoda/contracts';
import { Alert, Button, Input, Modal, Skeleton } from '@/shared/ui';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { formatBs } from '@/shared/format/currency';
import type { HttpError } from '@/shared/services/httpClient';
import {
  useCloseToday,
  useDailyReportByDate,
} from '../hooks/useDailyReports';

interface CloseDayModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
  /** Optional callback fired when the cierre succeeds. Lets the page wipe the
   *  visible "today" state without persisting a real lock yet. */
  onClosedToday?: () => void;
}

function todayIsoBolivia(): string {
  const now = new Date();
  const local = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function CloseDayModal({ storeId, open, onClose, onClosedToday }: CloseDayModalProps) {
  const today = useMemo(() => todayIsoBolivia(), []);
  const existing = useDailyReportByDate(open ? storeId : undefined, open ? today : undefined);
  const closeMutation = useCloseToday(storeId);
  const currentUser = useAuthStore((s) => s.user);

  const [confirmed, setConfirmed] = useState(false);
  const [primary, setPrimary] = useState(''); // encargada / cuenta principal
  const [extras, setExtras] = useState<string[]>([]);
  const [extraInput, setExtraInput] = useState('');

  // When the modal opens, prefill from previous cierre OR from the auth user's
  // own name (the encargada most likely closing the day).
  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setExtraInput('');
      closeMutation.reset();
      return;
    }
    if (existing.data && existing.data.attendees.length > 0) {
      const [head, ...tail] = existing.data.attendees;
      setPrimary(head?.fullName ?? '');
      setExtras(tail.map((a) => a.fullName));
    } else {
      setPrimary(currentUser?.fullName ?? '');
      setExtras([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing.data?.id]);

  const closedReport: DailyReportDTO | null = closeMutation.data ?? existing.data ?? null;
  const isAlreadyClosed = !confirmed && Boolean(existing.data);
  const errorMsg = useErrorMessage(closeMutation.error as HttpError | null);

  const addExtra = () => {
    const v = extraInput.trim();
    if (!v) return;
    if (extras.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setExtraInput('');
      return;
    }
    setExtras((prev) => [...prev, v]);
    setExtraInput('');
  };

  const removeExtra = (idx: number) =>
    setExtras((prev) => prev.filter((_, i) => i !== idx));

  const submit = () => {
    setConfirmed(true);
    const names = [primary.trim(), ...extras].filter((n) => n.length > 0);
    closeMutation.mutate(
      { attendedNames: names },
      {
        onSuccess: () => {
          // FUTURE: persist a real "no more sales after cierre" lock here. For
          // now we just let the page wipe its visible state via the callback.
          onClosedToday?.();
        },
      },
    );
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
          <label htmlFor="close-day-primary" className="text-sm font-semibold block">
            Encargada / cuenta asociada
          </label>
          <p className="text-xs text-slate-500 mb-1">
            Nombre principal responsable del cierre del día.
          </p>
          <Input
            id="close-day-primary"
            type="text"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            placeholder="Ej: María Pérez"
            maxLength={100}
            className="text-sm"
          />
        </div>

        <div>
          <label htmlFor="close-day-extras" className="text-sm font-semibold block">
            Otros nombres que atendieron hoy
          </label>
          <p className="text-xs text-slate-500 mb-1">
            Escribí cada nombre y presioná Enter (o coma) para agregarlo.
          </p>
          <Input
            id="close-day-extras"
            type="text"
            value={extraInput}
            onChange={(e) => setExtraInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addExtra();
              }
            }}
            placeholder="Ej: Lucía"
            maxLength={100}
            className="text-sm"
          />
          {extras.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-2">
              {extras.map((name, i) => (
                <li
                  key={`${name}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 text-xs px-2 py-0.5"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => removeExtra(i)}
                    className="hover:text-violet-900"
                    aria-label={`Quitar ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
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
            disabled={closeMutation.isPending || existing.isLoading || !primary.trim()}
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
