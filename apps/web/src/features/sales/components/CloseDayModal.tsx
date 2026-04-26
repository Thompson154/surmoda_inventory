import { Alert, Button, Modal } from '@/shared/ui';
import { useSalesDashboard } from '../hooks/useSales';

interface CloseDayModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

function formatBs(cents: number): string {
  return `Bs. ${(cents / 100).toFixed(2)}`;
}

/**
 * Day-close confirmation. Today this only displays the running totals; the actual
 * DailyReport persistence + auto-close cron lives in feature 007.
 */
export function CloseDayModal({ storeId, open, onClose }: CloseDayModalProps) {
  const dashboard = useSalesDashboard(open ? storeId : undefined);

  return (
    <Modal isOpen={open} onClose={onClose} title="Cerrar día">
      <div className="flex flex-col gap-3">
        <Alert variant="warning">
          El cierre formal con reporte diario inmutable se habilita en feature 007. Por
          ahora podés revisar el resumen del día.
        </Alert>

        {dashboard.data && (
          <ul className="rounded-lg border border-surface-border divide-y divide-surface-border text-sm">
            <li className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-600">Total</span>
              <span className="font-mono font-semibold">{formatBs(dashboard.data.todayCents)}</span>
            </li>
            <li className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-600">Efectivo</span>
              <span className="font-mono">
                {formatBs(dashboard.data.dailyBreakdown[0]?.cashCents ?? 0)}
              </span>
            </li>
            <li className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-600">QR</span>
              <span className="font-mono">
                {formatBs(dashboard.data.dailyBreakdown[0]?.qrCents ?? 0)}
              </span>
            </li>
            <li className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-600">Tarjeta</span>
              <span className="font-mono">
                {formatBs(dashboard.data.dailyBreakdown[0]?.cardCents ?? 0)}
              </span>
            </li>
          </ul>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="primary" size="md" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
