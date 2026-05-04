import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useReturnRequestDetail,
  useApproveReturnRequest,
  useRejectReturnRequest,
} from '../hooks/useReturnRequests';
import { Alert, Button, ConfirmDialog, Skeleton } from '@/shared/ui';
import { useToast } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';

export function ReviewReturnRequestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: req, isLoading, isError } = useReturnRequestDetail(id ?? '');
  const approve = useApproveReturnRequest();
  const reject = useRejectReturnRequest();

  const approveError = useErrorMessage(approve.error as HttpError | null | undefined);
  const rejectError = useErrorMessage(reject.error as HttpError | null | undefined);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  function handleApprove() {
    if (!id) return;
    approve.mutate(id, {
      onSuccess: () => {
        toast.success('Solicitud aprobada');
        setApproveOpen(false);
        void navigate('/admin/return-requests');
      },
      onError: () => {
        setApproveOpen(false);
        toast.error(approveError ?? 'No pudimos aprobar la solicitud.');
      },
    });
  }

  function handleReject(reason: string | undefined) {
    if (!id || !reason) return;
    reject.mutate(
      { id, rejectionReason: reason },
      {
        onSuccess: () => {
          toast.success('Solicitud rechazada');
          setRejectOpen(false);
          void navigate('/admin/return-requests');
        },
        onError: () => {
          setRejectOpen(false);
          toast.error(rejectError ?? 'No pudimos rechazar la solicitud.');
        },
      },
    );
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-3 p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (isError || !req) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-3 p-4">
        <Alert variant="error">No pudimos cargar la solicitud.</Alert>
      </main>
    );
  }

  const isPending = req.status === 'pending';

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 p-4 text-text-primary">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate('/admin/return-requests')}
          className="text-sm text-brand hover:underline"
        >
          ← Volver
        </button>
      </div>

      <h1 className="text-xl font-semibold">Revisar solicitud</h1>

      <div className="rounded-lg border border-surface-border bg-surface-raised p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-text-muted">Solicitado por</p>
            <p className="font-semibold">{req.requestedByFullName}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Sede</p>
            <p className="font-semibold">{req.storeName}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Barcode a devolver</p>
            <p className="font-mono">{req.returnedVariantBarcode}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Fecha de venta</p>
            <p>{req.saleDate}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Cantidad</p>
            <p>{req.quantity}</p>
          </div>
          {req.exchangeVariantBarcode && (
            <div>
              <p className="text-xs text-text-muted">Barcode de cambio</p>
              <p className="font-mono">{req.exchangeVariantBarcode}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-text-muted">Motivo</p>
          <p className="text-sm text-text-primary mt-0.5">{req.reason}</p>
        </div>

        {req.status !== 'pending' && (
          <div className="rounded-md bg-surface-sunken px-3 py-2 text-xs text-text-secondary">
            Estado: <strong>{req.status === 'approved' ? 'Aprobada' : 'Rechazada'}</strong>
            {req.rejectionReason && ` · ${req.rejectionReason}`}
          </div>
        )}
      </div>

      {isPending && (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setApproveOpen(true)}
            disabled={approve.isPending || reject.isPending}
            className="flex-1"
          >
            Aprobar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setRejectOpen(true)}
            disabled={approve.isPending || reject.isPending}
            className="flex-1 border-status-danger text-status-danger hover:bg-status-danger-soft"
          >
            Rechazar
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        title="Aprobar solicitud"
        description={`Vas a aprobar la devolución de ${req.quantity} unidad(es) del código ${req.returnedVariantBarcode}. Se ajustará el stock automáticamente.`}
        variant="default"
        isPending={approve.isPending}
      />

      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Rechazar solicitud"
        description="Explicá por qué rechazás esta solicitud."
        variant="danger"
        requiresReason
        reasonLabel="Motivo del rechazo"
        reasonPlaceholder="Explicá el motivo del rechazo"
        reasonMinLength={3}
        isPending={reject.isPending}
      />
    </main>
  );
}
