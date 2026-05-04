import { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import type {
  DeliveryStatus,
  DeliveryWithItems,
  ReceiveDeliveryItemAdjustment,
} from '@surmoda/contracts';
import { useConfirmDraftDelivery, useDelivery, useReceiveDelivery } from '../hooks/useDeliveries';
import { useRequestDeliveryEdit } from '../hooks/useRequestDeliveryEdit';
import { Alert, Button, ConfirmDialog, Modal, Skeleton } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { useStoreScope } from '@/shared/hooks/useStoreScope';
import { useToast } from '@/shared/ui';
import type { HttpError } from '@/shared/services/httpClient';

interface DeliveryDetailDrawerProps {
  deliveryId: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  received: 'Recibida',
  partial: 'Parcial',
};

const STATUS_PALETTE: Record<DeliveryStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-surface-sunken', text: 'text-text-secondary' },
  sent: { bg: 'bg-status-warning-soft', text: 'text-status-warning' },
  received: { bg: 'bg-status-success-soft', text: 'text-status-success' },
  partial: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const MONTH_ABBR = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

function formatNumber(n: number): string {
  return `EN-${n.toString().padStart(4, '0')}`;
}

export function DeliveryDetailDrawer({ deliveryId, onClose }: DeliveryDetailDrawerProps) {
  const open = deliveryId !== null;
  const query = useDelivery(open ? (deliveryId ?? undefined) : undefined);
  const data: DeliveryWithItems | undefined = query.data;

  // Receive form state — keyed by deliveryItemId, defaults to "received as expected".
  const [receivedQty, setReceivedQty] = useState<Record<string, number>>({});
  const [reasonByItem, setReasonByItem] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmReceive, setConfirmReceive] = useState(false);

  const [editRequestOpen, setEditRequestOpen] = useState(false);
  const editRequestMutation = useRequestDeliveryEdit();
  const editRequestError = useErrorMessage(editRequestMutation.error as HttpError | null);
  const toast = useToast();

  // Reset form when a new delivery loads.
  useEffect(() => {
    if (!data) return;
    const init: Record<string, number> = {};
    for (const i of data.items) {
      init[i.id] = i.receivedQuantity ?? i.quantity;
    }
    setReceivedQty(init);
    setReasonByItem({});
    setShowHistory(false);
  }, [data?.id]);

  const scope = useStoreScope(data?.toStoreId ?? null);
  const canConfirmDraft = scope.canManage;
  const canManage = scope.canManage;

  const confirmMutation = useConfirmDraftDelivery();
  const receiveMutation = useReceiveDelivery();
  const confirmError = useErrorMessage(confirmMutation.error as HttpError | null);
  const receiveError = useErrorMessage(receiveMutation.error as HttpError | null);

  const adjustmentsByItemId = useMemo(() => {
    const m = new Map<string, DeliveryWithItems['adjustments']>();
    if (!data) return m;
    for (const adj of data.adjustments) {
      const arr = m.get(adj.deliveryItemId) ?? [];
      arr.push(adj);
      m.set(adj.deliveryItemId, arr);
    }
    return m;
  }, [data]);

  const isPartialPreview = useMemo(() => {
    if (!data) return false;
    return data.items.some((i) => (receivedQty[i.id] ?? i.quantity) !== i.quantity);
  }, [data, receivedQty]);

  const handleReceive = () => {
    if (!data) return;
    const payload: ReceiveDeliveryItemAdjustment[] = data.items.map((i) => ({
      deliveryItemId: i.id,
      receivedQuantity: receivedQty[i.id] ?? i.quantity,
      reason: reasonByItem[i.id]?.trim() || undefined,
    }));
    receiveMutation.mutate({ deliveryId: data.id, payload: { items: payload } });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={data ? formatNumber(data.number) : 'Entrega'}>
      <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
        {query.isLoading && (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        )}
        {query.isError && <Alert variant="error">No pudimos cargar la entrega.</Alert>}

        {data && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full ${STATUS_PALETTE[data.status].bg} ${STATUS_PALETTE[data.status].text} text-xs font-semibold px-2.5 py-0.5`}
              >
                {STATUS_LABEL[data.status]}
              </span>
              <span className="text-xs text-text-muted">
                {shortDate(data.createdAt)} · {data.fromStoreName ?? 'Almacén'} → {data.toStoreName}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {data.title ?? 'Entrega sin título'}
              </h3>
              <p className="text-sm text-text-muted">
                {data.totalUnits} {data.totalUnits === 1 ? 'prenda' : 'prendas'} en este envío
              </p>
            </div>

            {data.note && (
              <p className="text-xs text-text-secondary italic border-l-2 border-surface-border pl-2">
                {data.note}
              </p>
            )}

            <div>
              <p className="text-sm font-semibold mb-2">Productos</p>
              <ul className="flex flex-col gap-2">
                {data.items.map((it) => {
                  const adjustments = adjustmentsByItemId.get(it.id) ?? [];
                  // WHY: only encargada/admin can adjust quantities per Wave 5
                  const editable = data.status === 'sent' && canManage;
                  const value = receivedQty[it.id] ?? it.quantity;
                  const adjusted = value !== it.quantity;
                  return (
                    <li
                      key={it.id}
                      className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">
                            {it.productName}
                          </p>
                          <p className="text-xs font-mono text-text-muted">{it.productCode}</p>
                        </div>
                        {editable ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-subtle">de {it.quantity}</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={it.quantity}
                              value={value}
                              onChange={(e) => {
                                const v = Math.max(
                                  0,
                                  Math.min(it.quantity, Number(e.target.value) || 0),
                                );
                                setReceivedQty((prev) => ({ ...prev, [it.id]: v }));
                              }}
                              className="w-16 rounded border border-surface-border text-sm text-right px-2 py-1 font-mono"
                              aria-label={`Recibidos de ${it.productCode}`}
                            />
                          </div>
                        ) : (
                          <p className="text-2xl font-semibold text-text-primary shrink-0">
                            ×{it.receivedQuantity ?? it.quantity}
                          </p>
                        )}
                      </div>
                      {editable && adjusted && (
                        <input
                          type="text"
                          placeholder="Motivo del ajuste (opcional, queda en auditoría)"
                          value={reasonByItem[it.id] ?? ''}
                          onChange={(e) =>
                            setReasonByItem((prev) => ({ ...prev, [it.id]: e.target.value }))
                          }
                          className="mt-2 w-full rounded border border-status-warning bg-status-warning-soft text-xs px-2 py-1"
                          maxLength={500}
                        />
                      )}
                      {adjustments.length > 0 && !editable && (
                        <ul className="mt-1.5 flex flex-col gap-0.5">
                          {adjustments.map((a) => (
                            <li
                              key={a.id}
                              className="text-[11px] text-status-warning bg-status-warning-soft rounded px-2 py-1"
                            >
                              Ajustada {a.expectedQty} → {a.actualQty} por {a.adjustedByFullName}
                              {a.reason ? ` · "${a.reason}"` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Actions */}
            {data.status === 'draft' && canConfirmDraft && (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setConfirmSend(true)}
                  isLoading={confirmMutation.isPending}
                  disabled={confirmMutation.isPending}
                >
                  Confirmar y enviar
                </Button>
                <ConfirmDialog
                  open={confirmSend}
                  onClose={() => setConfirmSend(false)}
                  onConfirm={() => {
                    confirmMutation.mutate({ deliveryId: data.id, payload: {} });
                    setConfirmSend(false);
                  }}
                  title="Confirmar y enviar entrega"
                  description="La entrega pasará a estado Enviada y no se podrá editar. ¿Confirmás el envío?"
                  confirmLabel="Enviar"
                  variant="default"
                  isPending={confirmMutation.isPending}
                />
              </>
            )}

            {data.status === 'sent' && (
              <div className="flex flex-col gap-2">
                {/* Solicitar edición — visible to all roles */}
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setEditRequestOpen(true)}
                >
                  Solicitar edición
                </Button>
                <ConfirmDialog
                  open={editRequestOpen}
                  onClose={() => setEditRequestOpen(false)}
                  onConfirm={(reason) => {
                    if (!reason) return;
                    editRequestMutation.mutate(
                      { deliveryId: data.id, payload: { reason } },
                      {
                        onSuccess: () => {
                          setEditRequestOpen(false);
                          toast.success('Solicitud enviada al admin');
                        },
                        onError: () => {
                          setEditRequestOpen(false);
                          toast.error(editRequestError ?? 'No pudimos enviar la solicitud.');
                        },
                      },
                    );
                  }}
                  title="Solicitar edición de entrega"
                  description="Mandá al admin la justificación. Mín 50 caracteres."
                  confirmLabel="Confirmar"
                  variant="default"
                  isPending={editRequestMutation.isPending}
                  requiresReason
                  reasonLabel="Motivo"
                  reasonPlaceholder="Explicá el motivo de la edición (mín 50 caracteres)"
                  reasonMinLength={50}
                />

                {/* Confirmar recepción — encargada/admin only */}
                {canManage && (
                  <>
                    {isPartialPreview && (
                      <Alert variant="info">
                        Vas a confirmar como <strong>parcial</strong>: las cantidades ajustadas
                        quedan en auditoría con tu nombre.
                      </Alert>
                    )}
                    <ConfirmDialog
                      open={confirmReceive}
                      onClose={() => setConfirmReceive(false)}
                      onConfirm={() => {
                        handleReceive();
                        setConfirmReceive(false);
                      }}
                      title="Confirmar recepción"
                      description="Una vez confirmado no se puede revertir."
                      confirmLabel="Confirmar"
                      variant="default"
                      isPending={receiveMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setConfirmReceive(true)}
                      isLoading={receiveMutation.isPending}
                      disabled={receiveMutation.isPending}
                    >
                      {isPartialPreview ? 'Confirmar recepción parcial' : 'Confirmar recepción'}
                    </Button>
                  </>
                )}
                {/* WHY: vendedora cannot confirm reception per Wave 5 BE */}
                {!canManage && (
                  <p className="text-xs text-text-muted text-center">
                    Solo encargada/admin puede confirmar recepción.
                  </p>
                )}
              </div>
            )}

            {data.status === 'received' && (
              <p className="text-xs text-text-muted text-center italic">
                Entrega confirmada — no se puede modificar.
              </p>
            )}

            {confirmError && <Alert variant="error">{confirmError}</Alert>}
            {receiveError && <Alert variant="error">{receiveError}</Alert>}

            {/* Audit history button */}
            {data.adjustments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-md border border-surface-border bg-surface-raised py-2 text-sm text-text-secondary hover:bg-surface-sunken"
              >
                <History className="h-4 w-4" />
                {showHistory ? 'Ocultar historial' : 'Ver historial de ajustes'}
              </button>
            )}
            {showHistory && data.adjustments.length > 0 && (
              <ul className="rounded border border-surface-border bg-surface-sunken p-2 flex flex-col gap-1 text-xs">
                {data.adjustments.map((a) => (
                  <li key={a.id}>
                    <span className="font-mono text-text-muted">
                      {new Date(a.adjustedAt).toLocaleString('es-BO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    {' · '}
                    <span className="font-semibold">{a.adjustedByFullName}</span>
                    {' · '}
                    <span>
                      {a.expectedQty} → {a.actualQty}
                    </span>
                    {a.reason ? (
                      <span className="italic text-text-muted"> · {a.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
