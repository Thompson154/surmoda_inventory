import { useState } from 'react';
import { useClosuresWithSales } from '../hooks/useReturnRequests';
import type { ClosureSaleItem, CreateReturnRequestPayload, PaymentMethod } from '../types';
import { Button, Input } from '@/shared/ui';
import { Modal } from '@/shared/ui';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  qr: 'QR',
};

export interface ReturnRequestFormProps {
  storeId: string;
  /** WHY: barcode of the NEW exchange product (scanned by scanner or ReturnScannerModal) */
  prefilledBarcode?: string;
  /** WHY: enables manual barcode entry inside Sección 1 when no scanner is present */
  manualBarcodeMode?: boolean;
  onSubmit: (payload: CreateReturnRequestPayload) => void;
  /** WHY: optional — only renders Cancel btn when caller needs it (e.g. modal) */
  onCancel?: () => void;
  isPending?: boolean;
}

export function ReturnRequestForm({
  storeId,
  prefilledBarcode,
  manualBarcodeMode = false,
  onSubmit,
  onCancel,
  isPending = false,
}: ReturnRequestFormProps) {
  // Sección 1 — new exchange product barcode (manual mode only)
  const [manualBarcode, setManualBarcode] = useState('');

  // Sección 2 — original sale identification
  const [closureDate, setClosureDate] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedItem, setSelectedItem] = useState<ClosureSaleItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Sección 3 — justification
  const [reason, setReason] = useState('');

  const closuresQuery = useClosuresWithSales(storeId, closureDate, closureDate);

  const allItems: Array<{ saleId: string; item: ClosureSaleItem }> =
    closuresQuery.data?.flatMap((closure) =>
      closure.sales.flatMap((sale) =>
        sale.saleItems.map((item) => ({ saleId: sale.saleId, item })),
      ),
    ) ?? [];

  // WHY: effective exchange barcode — prefer scanner, fall back to manual input
  const effectiveExchangeBarcode = prefilledBarcode ?? manualBarcode;
  const showManualInput = manualBarcodeMode || !prefilledBarcode;

  const pickerEnabled = Boolean(closureDate) && !closuresQuery.isLoading && allItems.length > 0;

  function handleSelectItem(saleId: string, item: ClosureSaleItem) {
    setSelectedSaleId(saleId);
    setSelectedItem(item);
    setPickerOpen(false);
  }

  const canSubmit =
    effectiveExchangeBarcode.trim().length >= 1 &&
    Boolean(closureDate) &&
    Boolean(selectedItem) &&
    Boolean(selectedSaleId) &&
    reason.trim().length >= 3 &&
    storeId.length > 0;

  function handleSubmit() {
    if (!canSubmit || !selectedItem || !selectedSaleId) return;

    onSubmit({
      storeId,
      returnedVariantBarcode: selectedItem.variantBarcode,
      returnedQuantity: selectedItem.quantity,
      saleDate: closureDate,
      exchangeVariantBarcode: effectiveExchangeBarcode.trim().toUpperCase(),
      reason: reason.trim(),
      originalSaleId: selectedSaleId,
      originalSaleItemId: selectedItem.id,
      originalClosureDate: closureDate,
      originalPaymentMethod: selectedItem.paymentMethod,
      originalSubtotalCents: selectedItem.subtotalCents,
      // WHY: pure exchange — money stays the same. New = original for these fields.
      newPaymentMethod: selectedItem.paymentMethod,
      newSubtotalCents: selectedItem.subtotalCents,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sección 1 — Producto nuevo (escaneado) */}
      <section className="flex flex-col gap-3 rounded-lg border border-surface-border p-3">
        <h2 className="text-sm font-semibold text-text-primary">1. Producto nuevo del cliente</h2>

        {showManualInput ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-barcode" className="text-sm font-medium text-text-secondary">
              Código del producto nuevo *
            </label>
            <Input
              id="manual-barcode"
              type="text"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.toUpperCase())}
              placeholder="Código del producto nuevo"
              className="font-mono uppercase"
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-text-muted">Producto nuevo escaneado</p>
            <Input
              id="exchange-barcode-display"
              type="text"
              value={prefilledBarcode}
              readOnly
              className="font-mono bg-surface-sunken"
              aria-label="Código del producto nuevo"
            />
          </div>
        )}
      </section>

      {/* Sección 2 — Identificar venta original */}
      <section className="flex flex-col gap-3 rounded-lg border border-surface-border p-3">
        <h2 className="text-sm font-semibold text-text-primary">2. Identificar venta original</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="closure-date" className="text-sm font-medium text-text-secondary">
            Fecha del cierre original *
          </label>
          <Input
            id="closure-date"
            type="date"
            value={closureDate}
            min={sevenDaysAgoIso()}
            max={todayIso()}
            onChange={(e) => {
              setClosureDate(e.target.value);
              setSelectedSaleId('');
              setSelectedItem(null);
            }}
            className="w-48"
          />
          <p className="text-xs text-text-muted">Máximo 7 días atrás</p>
        </div>

        {closureDate && closuresQuery.isLoading && (
          <p className="text-xs text-text-muted">Buscando ventas...</p>
        )}

        {closureDate && !closuresQuery.isLoading && allItems.length === 0 && (
          <p className="text-xs text-status-warning">No hay ventas registradas para ese día.</p>
        )}

        {selectedItem ? (
          <div className="flex flex-col gap-2 rounded-md border border-brand bg-brand/5 px-3 py-2">
            <p className="text-sm font-semibold text-text-primary">{selectedItem.productName}</p>
            <p className="font-mono text-xs text-text-muted">{selectedItem.variantBarcode}</p>
            <p className="text-xs text-text-secondary">
              {PAYMENT_LABELS[selectedItem.paymentMethod]} · Bs{' '}
              {(selectedItem.subtotalCents / 100).toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="self-start text-xs text-brand underline hover:no-underline"
            >
              Cambiar selección
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setPickerOpen(true)}
            disabled={!pickerEnabled}
          >
            Seleccionar producto a cambiar
          </Button>
        )}

        {/* Item picker modal */}
        <Modal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={closureDate ? `Productos vendidos el ${closureDate}` : 'Seleccionar producto'}
        >
          <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {allItems.map(({ saleId, item }) => (
              <li
                key={item.id}
                className="cursor-pointer rounded-md border border-surface-border px-3 py-2 text-sm hover:bg-surface-sunken transition-colors"
                onClick={() => handleSelectItem(saleId, item)}
                role="option"
                aria-selected={selectedItem?.id === item.id}
              >
                <p className="font-medium text-text-primary">{item.productName}</p>
                <p className="font-mono text-xs text-text-muted">{item.variantBarcode}</p>
                <p className="text-xs text-text-secondary">
                  {PAYMENT_LABELS[item.paymentMethod]} · Bs {(item.subtotalCents / 100).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        </Modal>
      </section>

      {/* Sección 3 — Justificación */}
      <section className="flex flex-col gap-3 rounded-lg border border-surface-border p-3">
        <h2 className="text-sm font-semibold text-text-primary">3. Justificación</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium text-text-secondary">
            Motivo *
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="Explicá brevemente el motivo de la devolución/cambio"
            rows={3}
            maxLength={200}
            className="w-full resize-none rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <p className="text-right text-xs text-text-muted">{reason.length}/200</p>
          {reason.trim().length > 0 && reason.trim().length < 3 && (
            <p className="text-xs text-status-danger">
              El motivo debe tener al menos 3 caracteres.
            </p>
          )}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          isLoading={isPending}
          className="flex-1"
        >
          Enviar solicitud
        </Button>
      </div>
    </div>
  );
}
