import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminReturnRequests } from '../hooks/useReturnRequests';
import type { ReturnRequestStatus } from '../types';
import { Alert, Skeleton } from '@/shared/ui';

type TabFilter = ReturnRequestStatus | 'all' | 'approved-recent';

const TABS: Array<{ value: TabFilter; label: string }> = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved-recent', label: 'Autorizadas recientemente' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
];

const STATUS_CLASSES: Record<ReturnRequestStatus, string> = {
  pending: 'bg-status-warning-soft text-status-warning',
  approved: 'bg-status-success-soft text-status-success',
  rejected: 'bg-status-danger-soft text-status-danger',
};

const STATUS_LABELS: Record<ReturnRequestStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export function AdminReturnRequestsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>('pending');
  // WHY: approved-recent is a special view: always approved, sorted by reviewedAt DESC, top 50
  const isRecentApproved = activeTab === 'approved-recent';
  const { data, isLoading, isError } = useAdminReturnRequests(
    activeTab === 'all'
      ? {}
      : isRecentApproved
        ? { status: 'approved', pageSize: 50 }
        : { status: activeTab as ReturnRequestStatus },
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 text-text-primary">
      <h1 className="text-xl font-semibold">Solicitudes de devolución</h1>

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
      {isError && <Alert variant="error">No pudimos cargar las solicitudes.</Alert>}

      {!isLoading && !isError && data?.items.length === 0 && (
        <p className="text-sm text-text-muted py-6 text-center">
          No hay solicitudes en esta categoría.
        </p>
      )}

      {data?.items.map((req) => (
        <div
          key={req.id}
          className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{req.requestedByFullName}</p>
              <span className="text-text-muted text-xs">·</span>
              <p className="text-xs text-text-muted">{req.storeName}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[req.status]}`}
              >
                {STATUS_LABELS[req.status]}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Barcode: <span className="font-mono">{req.returnedVariantBarcode}</span>
              {' · '}Fecha venta: {req.saleDate}
              {' · '}Cantidad: {req.quantity}
            </p>
            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{req.reason}</p>
          </div>

          <Link
            to={`/admin/return-requests/${req.id}`}
            className="shrink-0 text-sm font-semibold text-brand hover:underline"
            aria-label={`Revisar solicitud de ${req.requestedByFullName}`}
          >
            Revisar
          </Link>
        </div>
      ))}
    </main>
  );
}
