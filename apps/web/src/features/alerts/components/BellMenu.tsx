import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarX, PackageX } from 'lucide-react';
import type { AlertDTO, AlertKind } from '@surmoda/contracts';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useAlerts } from '../hooks/useAlerts';

const ICON_FOR: Record<AlertKind, typeof Bell> = {
  STOCK_LOW: AlertTriangle,
  STOCK_OUT_HOT: PackageX,
  CIERRE_MISSING: CalendarX,
};

const PALETTE_FOR: Record<AlertDTO['severity'], { bg: string; text: string }> = {
  info: { bg: 'bg-blue-100', text: 'text-blue-700' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700' },
  critical: { bg: 'bg-rose-100', text: 'text-rose-700' },
};

export function BellMenu() {
  const user = useAuthStore((s) => s.user);
  const canSee =
    Boolean(user) &&
    (user!.isAdmin || user!.assignments.some((a) => a.role === 'encargada'));

  const alerts = useAlerts(canSee);
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
        <Bell className="h-5 w-5 text-slate-600" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-surface-border bg-white shadow-lg z-40">
          <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
            <p className="text-sm font-semibold">Alertas operativas</p>
            <span className="text-[10px] text-slate-500">
              {total} pendiente{total === 1 ? '' : 's'}
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {alerts.isLoading && (
              <p className="text-xs text-slate-500 px-3 py-4">Cargando…</p>
            )}
            {!alerts.isLoading && items.length === 0 && (
              <p className="text-sm text-slate-500 px-3 py-6 text-center">
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
                  className="w-full text-left px-3 py-2.5 border-b border-surface-border last:border-b-0 hover:bg-surface-sunken flex items-start gap-2.5"
                >
                  <div className={`h-7 w-7 rounded ${palette.bg} ${palette.text} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs text-slate-700 flex-1">{a.message}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
