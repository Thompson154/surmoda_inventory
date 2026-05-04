import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarX, PackageX } from 'lucide-react';
import type { AlertDTO, AlertKind } from '@surmoda/contracts';
import { useAlerts } from '../hooks/useAlerts';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

const ICON_FOR: Record<AlertKind, typeof Bell> = {
  STOCK_LOW: AlertTriangle,
  STOCK_OUT_HOT: PackageX,
  CIERRE_MISSING: CalendarX,
};

const PALETTE_FOR: Record<AlertDTO['severity'], { bg: string; text: string }> = {
  info: { bg: 'bg-status-info-soft', text: 'text-status-info' },
  warning: { bg: 'bg-status-warning-soft', text: 'text-status-warning' },
  critical: { bg: 'bg-status-danger-soft', text: 'text-status-danger' },
};

export function BellMenu() {
  const user = useAuthStore((s) => s.user);
  const canSee =
    Boolean(user) && (user!.isAdmin || user!.assignments.some((a) => a.role === 'encargada'));

  // Bug A fix: read the active storeId from the route, if any.
  // When inside /sedes/:storeId/*, only that branch's alerts are fetched.
  // When on /sedes picker, /admin or any global route, storeId is undefined
  // and the endpoint returns all alerts (no filter).
  const { storeId } = useParams<{ storeId?: string }>();

  const alerts = useAlerts(canSee, storeId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!canSee) return null;

  const total = alerts.data?.items.length ?? 0;
  const items = alerts.data?.items ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-full hover:bg-surface-sunken flex items-center justify-center"
        aria-label={`Alertas (${total})`}
      >
        <Bell className="h-5 w-5 text-text-secondary" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-status-danger text-white text-[10px] font-bold flex items-center justify-center px-1">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        /*
         * Bug B fix — Z Fold responsive:
         *
         * Z Fold cerrado (~280-340px):
         *   - El panel se ancla a la derecha del viewport con `right-0` pero
         *     también fijamos `left-auto` para no desbordarse.
         *   - `w-[min(320px,calc(100vw-0.5rem))]` permite encoger hasta casi
         *     todo el viewport en pantallas muy chicas.
         *   - `min-w-0` en los children de flex evita el bug clásico donde un
         *     flex-item no se encoge más allá del tamaño de su contenido.
         *
         * Z Fold abierto (~2076px):
         *   - El panel ya crece hasta 320px y no tiene max-w que lo limite
         *     más allá de eso — en pantallas anchas se ve compacto y centrado
         *     en el header, que también está max-w-4xl.
         */
        <div
          className="absolute right-0 mt-2 rounded-lg border border-surface-border bg-surface-raised shadow-lg z-40"
          style={{ width: 'min(320px, calc(100vw - 0.5rem))' }}
        >
          <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between min-w-0">
            <p className="text-sm font-semibold truncate">Alertas operativas</p>
            <span className="text-[10px] text-text-muted shrink-0 ml-2">
              {total} pendiente{total === 1 ? '' : 's'}
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {alerts.isLoading && <p className="text-xs text-text-muted px-3 py-4">Cargando…</p>}
            {!alerts.isLoading && items.length === 0 && (
              <p className="text-sm text-text-muted px-3 py-6 text-center">
                Todo en orden — no hay alertas activas.
              </p>
            )}
            {items.map((a) => {
              const Icon = ICON_FOR[a.kind];
              const palette = PALETTE_FOR[a.severity];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(a.link);
                  }}
                  className="w-full text-left px-3 py-2.5 border-b border-surface-border last:border-b-0 hover:bg-surface-sunken flex items-start gap-2.5 min-w-0"
                >
                  <div
                    className={`h-7 w-7 rounded ${palette.bg} ${palette.text} flex items-center justify-center shrink-0 mt-0.5`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {/* min-w-0 es crítico: sin él, un texto largo hace que el
                      flex-item no se encoja y desborda en Z Fold cerrado */}
                  <p className="text-xs text-text-secondary flex-1 min-w-0 break-words">
                    {a.message}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
