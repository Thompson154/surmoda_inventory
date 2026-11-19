import { useEffect, useMemo, useState } from 'react';
import { History, Pencil, Trash2 } from 'lucide-react';
import type {
  DeliveryStatus,
  DeliveryWithItems,
  ReceiveDeliveryItemAdjustment,
} from '@surmoda/contracts';
import {
  useConfirmDraftDelivery,
  useConfirmPartialDelivery,
  useDeleteSentDelivery,
  useDelivery,
  useReceiveDelivery,
} from '../hooks/useDeliveries';
import { Alert, Button, ConfirmDialog, Modal, Skeleton, useToast } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { useStoreParam } from '@/shared/hooks/useStoreParam';
import { useStoreScope } from '@/shared/hooks/useStoreScope';
import type { HttpError } from '@/shared/services/httpClient';

interface DeliveryDetailDrawerProps {
  deliveryId: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  received: 'Recibida',
  partial: 'Recibido parcialmente · En revisión',
  partial_confirmed: 'Recibido parcialmente - Confirmado',
};

const STATUS_PALETTE: Record<DeliveryStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-surface-sunken', text: 'text-text-secondary' },
  sent: { bg: 'bg-status-warning-soft', text: 'text-status-warning' },
  received: { bg: 'bg-status-success-soft', text: 'text-status-success' },
  partial: { bg: 'bg-orange-100', text: 'text-orange-700' },
  partial_confirmed: { bg: 'bg-status-success-soft', text: 'text-status-success' },
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
  const [confirmPartialOpen, setConfirmPartialOpen] = useState(false);
  const [confirmDeleteSent, setConfirmDeleteSent] = useState(false);
  // Reception edit flow: editing is locked until encargada confirms the edit popup.
  const [isEditingReception, setIsEditingReception] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
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
    setIsEditingReception(false);
    setConfirmEditOpen(false);
    setDiscrepancyReason('');
  }, [data?.id, data?.status]);

  const activeStoreId = useStoreParam();
  const scope = useStoreScope(data?.toStoreId ?? null);
  const originScope = useStoreScope(data?.fromStoreId ?? null);
  const canConfirmDraft = scope.canManage;
  const canManage = scope.canManage;
  const hasOriginConfirmRole =
    scope.isAdmin || scope.hasEncargadaRole || originScope.directRole === 'encargada';
  const isAtOriginStore =
    activeStoreId == null || !data?.fromStoreId || activeStoreId === data.fromStoreId;
  const canConfirmPartial = hasOriginConfirmRole && isAtOriginStore;

  const confirmMutation = useConfirmDraftDelivery();
  const receiveMutation = useReceiveDelivery();
  const confirmPartialMutation = useConfirmPartialDelivery();
  const deleteSentMutation = useDeleteSentDelivery();
  const confirmError = useErrorMessage(confirmMutation.error as HttpError | null);
  const receiveError = useErrorMessage(receiveMutation.error as HttpError | null);
  const confirmPartialError = useErrorMessage(confirmPartialMutation.error as HttpError | null);
  const deleteSentError = useErrorMessage(deleteSentMutation.error as HttpError | null);

  // Reset transient confirmation dialogs and mutation errors when closing or switching delivery.
  useEffect(() => {
    setConfirmSend(false);
    setConfirmReceive(false);
    setConfirmPartialOpen(false);
    setConfirmDeleteSent(false);
    setConfirmEditOpen(false);
    setIsEditingReception(false);
    setDiscrepancyReason('');
    confirmMutation.reset();
    receiveMutation.reset();
    confirmPartialMutation.reset();
    deleteSentMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deliveryId]);

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
    const fallbackReason = isEditingReception ? discrepancyReason.trim() : undefined;
    const payload: ReceiveDeliveryItemAdjustment[] = data.items.map((i) => ({
      deliveryItemId: i.id,
      receivedQuantity: receivedQty[i.id] ?? i.quantity,
      reason: reasonByItem[i.id]?.trim() || fallbackReason || undefined,
    }));
    receiveMutation.mutate(
      { deliveryId: data.id, payload: { items: payload } },
      {
        onSuccess: () => {
          if (isEditingReception) {
            toast.info('Recepción parcial reportada. Queda en revisión para Almacén / Admin.');
          } else {
            toast.success('Recepción confirmada exitosamente.');
          }
          setIsEditingReception(false);
          setDiscrepancyReason('');
        },
      },
    );
  };

  const handleConfirmPartial = () => {
    if (!data) return;
    const items = data.items.map((i) => ({
      deliveryItemId: i.id,
      confirmedQuantity: receivedQty[i.id] ?? i.receivedQuantity ?? i.quantity,
      reason: reasonByItem[i.id]?.trim() || undefined,
    }));
    confirmPartialMutation.mutate({ deliveryId: data.id, payload: { items } });
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Productos</p>
                {data.status === 'sent' && canManage && !isEditingReception && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setConfirmEditOpen(true)}
                    aria-label="Editar recepción"
                  >
                    Editar
                  </Button>
                )}
                {data.status === 'sent' && canManage && isEditingReception && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const init: Record<string, number> = {};
                      for (const i of data.items) {
                        init[i.id] = i.quantity;
                      }
                      setReceivedQty(init);
                      setReasonByItem({});
                      setDiscrepancyReason('');
                      setIsEditingReception(false);
                    }}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Cancelar edición
                  </Button>
                )}
              </div>

              {data.status === 'sent' && canManage && isEditingReception && (
                <Alert variant="warning" className="mb-2">
                  Modo edición activado: Modificá las cantidades recibidas e ingresá el motivo
                  obligatorio de la discrepancia.
                </Alert>
              )}

              <ul className="flex flex-col gap-2">
                {data.items.map((it) => {
                  const adjustments = adjustmentsByItemId.get(it.id) ?? [];
                  const editable =
                    (data.status === 'sent' && canManage && isEditingReception) ||
                    (data.status === 'partial' && canConfirmPartial);
                  const value = receivedQty[it.id] ?? it.receivedQuantity ?? it.quantity;
                  const adjusted =
                    data.status === 'sent'
                      ? value !== it.quantity
                      : value !== (it.receivedQuantity ?? it.quantity);
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
                              className="w-16 rounded border border-surface-border text-sm text-right px-2 py-1 font-mono focus:border-brand-primary"
                              aria-label={`Recibidos de ${it.productCode}`}
                            />
                          </div>
                        ) : data.status === 'sent' ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-subtle">de {it.quantity}</span>
                            <span className="text-sm font-semibold text-text-primary px-2.5 py-1 rounded bg-surface-sunken font-mono">
                              {it.quantity}
                            </span>
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
                          placeholder="Nota individual por ítem (opcional)"
                          value={reasonByItem[it.id] ?? ''}
                          onChange={(e) =>
                            setReasonByItem((prev) => ({ ...prev, [it.id]: e.target.value }))
                          }
                          className="mt-2 w-full rounded border border-status-warning bg-status-warning-soft text-xs px-2 py-1"
                          maxLength={500}
                        />
                      )}
                      {adjustments.length > 0 && (!editable || data.status === 'partial') && (
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

              {data.status === 'sent' && canManage && isEditingReception && (
                <div className="mt-3 flex flex-col gap-1.5 p-3 rounded-lg border border-status-warning bg-status-warning-soft/30">
                  <label
                    htmlFor="discrepancy-reason"
                    className="text-xs font-semibold text-text-primary"
                  >
                    Motivo de la discrepancia / mermas <span className="text-status-danger">*</span>
                  </label>
                  <textarea
                    id="discrepancy-reason"
                    rows={3}
                    placeholder="Explicá por qué llegó menos mercadería (obligatorio para control de mermas)..."
                    value={discrepancyReason}
                    onChange={(e) => setDiscrepancyReason(e.target.value)}
                    className="w-full rounded border border-surface-border bg-surface-base p-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                    required
                  />
                  {!discrepancyReason.trim() && (
                    <p className="text-[11px] text-status-danger font-medium">
                      El motivo es obligatorio para poder reportar la recepción parcial.
                    </p>
                  )}
                </div>
              )}
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
                {/* Confirmar recepción — encargada/admin only */}
                {canManage && (
                  <>
                    <ConfirmDialog
                      open={confirmEditOpen}
                      onClose={() => setConfirmEditOpen(false)}
                      onConfirm={() => {
                        setIsEditingReception(true);
                        setConfirmEditOpen(false);
                      }}
                      title="¿Editar recepción de mercadería?"
                      description="¿Está seguro de que quiere editar la recepción porque le llegaron menos productos?"
                      confirmLabel="Sí, editar recepción"
                      variant="default"
                    />

                    {isEditingReception ? (
                      <>
                        {isPartialPreview && (
                          <Alert variant="info">
                            Vas a reportar una <strong>recepción parcial (en revisión)</strong>:
                            quedará pendiente hasta que {data.fromStoreName ?? 'Almacén Central'}{' '}
                            confirme los montos reales y ajuste el stock.
                          </Alert>
                        )}
                        <ConfirmDialog
                          open={confirmReceive}
                          onClose={() => setConfirmReceive(false)}
                          onConfirm={() => {
                            handleReceive();
                            setConfirmReceive(false);
                          }}
                          title="Reportar recepción parcial"
                          description={`La entrega pasará a estado en revisión con motivo de merma: "${discrepancyReason.trim()}". Se notificará al administrador para confirmar esta discrepancia.`}
                          confirmLabel="Enviar a revisión"
                          variant="default"
                          isPending={receiveMutation.isPending}
                        />
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          onClick={() => setConfirmReceive(true)}
                          isLoading={receiveMutation.isPending}
                          disabled={receiveMutation.isPending || !discrepancyReason.trim()}
                        >
                          Recibir recepción parcialmente
                        </Button>
                        {!discrepancyReason.trim() && (
                          <p className="text-xs text-status-danger text-center font-medium">
                            Ingresá el motivo obligatorio arriba para poder recibir parcialmente.
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const init: Record<string, number> = {};
                            for (const i of data.items) {
                              init[i.id] = i.quantity;
                            }
                            setReceivedQty(init);
                            setReasonByItem({});
                            setDiscrepancyReason('');
                            setIsEditingReception(false);
                          }}
                          disabled={receiveMutation.isPending}
                        >
                          Cancelar edición y volver a recepción completa
                        </Button>
                      </>
                    ) : (
                      <>
                        <ConfirmDialog
                          open={confirmReceive}
                          onClose={() => setConfirmReceive(false)}
                          onConfirm={() => {
                            handleReceive();
                            setConfirmReceive(false);
                          }}
                          title="Confirmar recepción"
                          description="¿Confirmás la recepción completa de la mercadería enviada? Una vez confirmado no se puede revertir."
                          confirmLabel="Confirmar recepción"
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
                          Confirmar recepción
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          leftIcon={<Pencil className="h-4 w-4" />}
                          onClick={() => setConfirmEditOpen(true)}
                          disabled={receiveMutation.isPending}
                        >
                          Editar recepción (llegaron menos)
                        </Button>
                      </>
                    )}
                  </>
                )}
                {/* WHY: vendedora cannot confirm reception per Wave 5 BE */}
                {!canManage && (
                  <p className="text-xs text-text-muted text-center">
                    Solo encargada/admin puede confirmar recepción.
                  </p>
                )}
                {scope.isAdmin && (
                  <>
                    <ConfirmDialog
                      open={confirmDeleteSent}
                      onClose={() => setConfirmDeleteSent(false)}
                      onConfirm={() => {
                        deleteSentMutation.mutate(data.id, {
                          onSuccess: () => {
                            setConfirmDeleteSent(false);
                            toast.success('Envío eliminado y stock devuelto al origen.');
                            onClose();
                          },
                          onError: () => {
                            setConfirmDeleteSent(false);
                          },
                        });
                      }}
                      title="Eliminar envío"
                      description="Se eliminará este envío y las prendas volverán al stock de la sede de origen. Esta acción no se puede deshacer."
                      confirmLabel="Eliminar envío"
                      variant="danger"
                      isPending={deleteSentMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() => setConfirmDeleteSent(true)}
                      isLoading={deleteSentMutation.isPending}
                      disabled={deleteSentMutation.isPending}
                    >
                      Eliminar envío
                    </Button>
                  </>
                )}
              </div>
            )}

            {data.status === 'partial' && (
              <div className="flex flex-col gap-2">
                {canConfirmPartial ? (
                  <>
                    <Alert variant="info">
                      La sucursal reportó recepción parcial. Al confirmar, Almacén Central
                      descontará solo lo confirmado (devolviendo la diferencia al almacén) y la
                      sucursal recibirá únicamente esas unidades.
                    </Alert>
                    <ConfirmDialog
                      open={confirmPartialOpen}
                      onClose={() => setConfirmPartialOpen(false)}
                      onConfirm={() => {
                        handleConfirmPartial();
                        setConfirmPartialOpen(false);
                      }}
                      title="Confirmar recepción parcial"
                      description="Se actualizará el stock en origen y destino según las cantidades confirmadas."
                      confirmLabel="Confirmar"
                      variant="default"
                      isPending={confirmPartialMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setConfirmPartialOpen(true)}
                      isLoading={confirmPartialMutation.isPending}
                      disabled={confirmPartialMutation.isPending}
                    >
                      Confirmar recepción parcial
                    </Button>
                  </>
                ) : (
                  <Alert variant="info">
                    {hasOriginConfirmRole && !isAtOriginStore
                      ? `Recepción parcial en revisión. Ve a ${data.fromStoreName ?? 'Almacén Central'} para confirmar definitivamente y ajustar el stock.`
                      : `Recepción parcial reportada. Esperando confirmación interna desde ${data.fromStoreName ?? 'Almacén Central'} o Administración para acreditar el stock.`}
                  </Alert>
                )}
              </div>
            )}

            {data.status === 'partial_confirmed' && (
              <p className="text-xs text-status-success text-center font-medium">
                Recibido parcialmente - Confirmado — stock ajustado en origen y destino.
              </p>
            )}

            {data.status === 'received' && (
              <p className="text-xs text-text-muted text-center italic">
                Entrega confirmada — no se puede modificar.
              </p>
            )}

            {confirmError && <Alert variant="error">{confirmError}</Alert>}
            {receiveError && <Alert variant="error">{receiveError}</Alert>}
            {confirmPartialError && <Alert variant="error">{confirmPartialError}</Alert>}
            {deleteSentError && <Alert variant="error">{deleteSentError}</Alert>}

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
