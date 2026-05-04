import { useState } from 'react';
import { useMyReturnRequests } from '../hooks/useReturnRequests';
import type { ReturnRequestStatus } from '../types';
import { Alert, Skeleton } from '@/shared/ui';

type TabFilter = ReturnRequestStatus | 'all';

const TABS: Array<{ value: TabFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
];

const STATUS_LABELS: Record<ReturnRequestStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const STATUS_CLASSES: Record<ReturnRequestStatus, string> = {
  pending: 'bg-status-warning-soft text-status-warning',
  approved: 'bg-status-success-soft text-status-success',
  rejected: 'bg-status-danger-soft text-status-danger',
};

export function MyReturnRequestsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const { data, isLoading, isError } = useMyReturnRequests(
    activeTab === 'all' ? {} : { status: activeTab },
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 text-text-primary">
      <h1 className="text-xl font-semibold">Mis solicitudes</h1>

      {/* Filter tabs */}
      <div role="tablist" className="flex gap-2 border-b border-surface-border pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
              activeTab === tab.value
                ? 'text-brand border-b-2 border-brand -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-20 w-full" />}
      {isError && <Alert variant="error">No pudimos cargar tus solicitudes.</Alert>}

      {!isLoading && !isError && data?.items.length === 0 && (
        <p className="text-sm text-text-muted py-6 text-center">No tenés solicitudes todavía.</p>
      )}

      {data?.items.map((req) => (
        <div
          key={req.id}
          className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3 flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold font-mono">{req.returnedVariantBarcode}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[req.status]}`}
            >
              {STATUS_LABELS[req.status]}
            </span>
          </div>

          <p className="text-xs text-text-muted">
            Fecha venta: {req.saleDate} · Cantidad: {req.quantity}
          </p>

          {req.exchangeVariantBarcode && (
            <p className="text-xs text-text-secondary">
              Cambio por: <span className="font-mono">{req.exchangeVariantBarcode}</span>
            </p>
          )}

          <p className="text-sm text-text-secondary">{req.reason}</p>

          {req.status === 'rejected' && req.rejectionReason && (
            <div className="mt-1 rounded-md bg-status-danger-soft px-2 py-1.5">
              <p className="text-xs font-medium text-status-danger">
                Motivo de rechazo: {req.rejectionReason}
              </p>
            </div>
          )}

          <p className="text-[10px] text-text-subtle">
            Enviada: {new Date(req.createdAt).toLocaleDateString('es-BO')}
          </p>
        </div>
      ))}
    </main>
  );
}
