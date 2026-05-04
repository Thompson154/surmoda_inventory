import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Image as ImageIcon, Minus, Plus, Save } from 'lucide-react';
import { SIZE_VALUES, type InventoryRow, type Size } from '@surmoda/contracts';
import { useAdjustQuantity } from '../hooks/useInventory';
import { inventoryQueryKeys } from '../services/inventoryService';
import { Alert, Badge, Button, ConfirmDialog, IconButton, Input, Modal } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import {
  getImageUrl,
  productsService,
  productsQueryKeys,
} from '@/features/products/services/productsService';
import { formatBs as formatPrice } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';

interface SingleVariantQuickEditModalProps {
  storeId: string;
  row: InventoryRow | null;
  canEdit: boolean;
  onClose: () => void;
}

const PRODUCT_CODE_REGEX = /^[A-Z0-9_]{2,15}$/;

/**
 * Edits stock + product/variant attributes for ONE variant (resolved by barcode).
 * Renders a compact form so the encargada/vendedora doesn't have to scroll
 * through every variant of the product.
 *
 * Editable fields (when `canEdit`):
 *  - código (product-level — regenerates barcodes for ALL variants)
 *  - talla, color, precio (variant-level — barcode regenerates if size/color change)
 *  - cantidad (stock movement via inventory.adjust)
 */
export function SingleVariantQuickEditModal({
  storeId,
  row,
  canEdit,
  onClose,
}: SingleVariantQuickEditModalProps) {
  const adjust = useAdjustQuantity(storeId);
  const qc = useQueryClient();

  // Drafts — default values come from `row`. Reset on row change.
  const [draftQty, setDraftQty] = useState(row?.quantity ?? 0);
  const [draftCode, setDraftCode] = useState(row?.productCode ?? '');
  const [draftSize, setDraftSize] = useState<Size>(row?.size ?? 'standard');
  const [draftColor, setDraftColor] = useState(row?.color ?? '');
  const [draftPriceBs, setDraftPriceBs] = useState(row ? (row.priceCents / 100).toString() : '');
  const [reason, setReason] = useState('');

  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // WHY: ConfirmDialog gates admin saves — records audit trail via required reason
  const [confirmOpen, setConfirmOpen] = useState(false);

  const adjustError = useErrorMessage(adjust.error as HttpError | null | undefined);

  const updateImage = useMutation({
    mutationFn: (file: File) =>
      productsService.updateVariant(row!.variantId, {
        image: file,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productsQueryKeys.all });
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.all });
      setPendingImage(null);
      setPreviewUrl(null);
    },
  });
  const imageError = useErrorMessage(updateImage.error as HttpError | null | undefined);

  useEffect(() => {
    if (row) {
      setDraftQty(row.quantity);
      setDraftCode(row.productCode);
      setDraftSize(row.size);
      setDraftColor(row.color);
      setDraftPriceBs((row.priceCents / 100).toString());
      setReason('');
      setPendingImage(null);
      setPreviewUrl(null);
      setSubmitError(null);
      setConfirmOpen(false);
      adjust.reset();
      updateImage.reset();
    }
  }, [row?.variantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke object URL when component unmounts or preview changes — avoids
  // leaking blob URLs across the app's lifetime.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Compute dirtiness up front so we can render warnings + gate the button.
  const draftCodeNormalized = draftCode.trim().toUpperCase();
  const draftColorNormalized = draftColor.trim();
  const parsedPriceBs = Number(draftPriceBs);
  const draftPriceCents = Number.isFinite(parsedPriceBs) ? Math.round(parsedPriceBs * 100) : NaN;

  const codeIsDirty = !!row && draftCodeNormalized !== row.productCode;
  const sizeIsDirty = !!row && draftSize !== row.size;
  const colorIsDirty = !!row && draftColorNormalized !== row.color;
  const priceIsDirty =
    !!row && Number.isFinite(draftPriceCents) && draftPriceCents !== row.priceCents;
  const qtyIsDirty = !!row && draftQty !== row.quantity;

  const anyDirty = codeIsDirty || sizeIsDirty || colorIsDirty || priceIsDirty || qtyIsDirty;

  // Validation gates: don't allow Guardar when a dirty field is invalid.
  const codeValid = !codeIsDirty || PRODUCT_CODE_REGEX.test(draftCodeNormalized);
  const colorValid =
    !colorIsDirty || (draftColorNormalized.length >= 1 && draftColorNormalized.length <= 32);
  const priceValid = !priceIsDirty || (Number.isFinite(draftPriceCents) && draftPriceCents >= 1);
  const allValid = codeValid && colorValid && priceValid;

  const sizeOptions = useMemo(
    () => SIZE_VALUES.map((s) => ({ value: s, label: sizeLabel(s) })),
    [],
  );

  if (!row) {
    return <Modal isOpen={false} onClose={onClose} title="Variante" children={null} />;
  }

  const imageUrl = previewUrl ?? getImageUrl(row.imagePath);

  // WHY: Guardar opens ConfirmDialog (admin audit trail) before firing mutations
  const handleGuardarClick = () => {
    if (!canEdit || !anyDirty || !allValid || submitting) return;
    setConfirmOpen(true);
  };

  // Sequence: code (cascades) -> variant patch (size/color/price) -> qty.
  const submit = async (confirmedReason?: string) => {
    if (!canEdit || !anyDirty || !allValid || submitting) return;

    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (codeIsDirty) {
        await productsService.update(row.productId, { code: draftCodeNormalized });
      }

      if (sizeIsDirty || colorIsDirty || priceIsDirty) {
        await productsService.updateVariant(row.variantId, {
          ...(priceIsDirty ? { priceCents: draftPriceCents } : {}),
          ...(sizeIsDirty ? { size: draftSize } : {}),
          ...(colorIsDirty ? { color: draftColorNormalized } : {}),
        });
      }

      if (qtyIsDirty) {
        await new Promise<void>((resolve, reject) => {
          adjust.mutate(
            {
              variantId: row.variantId,
              // WHY: reason from ConfirmDialog takes precedence over inline field
              payload: { quantity: draftQty, reason: confirmedReason || reason || undefined },
            },
            { onSuccess: () => resolve(), onError: (err) => reject(err) },
          );
        });
      }

      void qc.invalidateQueries({ queryKey: productsQueryKeys.all });
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.all });
      onClose();
    } catch (err) {
      const e = err as { message?: string; code?: string };
      setSubmitError(e?.message ?? 'No pudimos guardar los cambios.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${row.productCode} · ${row.barcode}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-surface-border p-3">
          <button
            type="button"
            onClick={() => canEdit && fileInputRef.current?.click()}
            disabled={!canEdit}
            className="h-16 w-16 shrink-0 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden relative group disabled:cursor-not-allowed"
            aria-label="Cambiar imagen"
          >
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-text-subtle" />
            )}
            {canEdit && (
              <span className="absolute inset-0 bg-black/40 text-white text-[10px] font-semibold flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-3.5 w-3.5" />
                Cambiar
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onPickImage}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{row.productName}</p>
            <p className="text-xs font-mono text-text-subtle mt-0.5">{row.barcode}</p>
            <p className="text-xs text-text-secondary mt-1">{formatPrice(row.priceCents)}</p>
          </div>
          {!canEdit && <Badge variant="default">Solo lectura</Badge>}
        </div>

        {pendingImage && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-status-warning bg-status-warning-soft px-3 py-2">
            <p className="text-xs text-status-warning">
              Nueva imagen lista — pesa {(pendingImage.size / 1024).toFixed(0)} KB.
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPendingImage(null);
                  setPreviewUrl(null);
                }}
                disabled={updateImage.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => updateImage.mutate(pendingImage)}
                isLoading={updateImage.isPending}
                disabled={updateImage.isPending}
              >
                Guardar imagen
              </Button>
            </div>
          </div>
        )}

        {imageError && <Alert variant="error">{imageError}</Alert>}

        {/* Editable details (código / talla / color / precio) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label
              htmlFor="svqe-code"
              className="block text-xs font-medium text-text-secondary mb-1"
            >
              Código
            </label>
            <Input
              id="svqe-code"
              type="text"
              value={draftCode}
              onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
              disabled={!canEdit}
              maxLength={15}
              className="text-sm py-1 font-mono uppercase"
              aria-invalid={!codeValid}
            />
            {!codeValid && (
              <p className="text-[11px] text-status-danger mt-1">
                Código inválido (2-15 caracteres: A-Z, 0-9, _).
              </p>
            )}
            {canEdit && codeIsDirty && codeValid && (
              <p className="text-[11px] text-status-warning mt-1">
                Cambiar el código regenera los códigos de barras de TODAS las variantes.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="svqe-size"
              className="block text-xs font-medium text-text-secondary mb-1"
            >
              Talla
            </label>
            <select
              id="svqe-size"
              value={draftSize}
              onChange={(e) => setDraftSize(e.target.value as Size)}
              disabled={!canEdit}
              className="w-full rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-sm disabled:bg-surface-sunken disabled:cursor-not-allowed"
            >
              {sizeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="svqe-color"
              className="block text-xs font-medium text-text-secondary mb-1"
            >
              Color
            </label>
            <Input
              id="svqe-color"
              type="text"
              value={draftColor}
              onChange={(e) => setDraftColor(e.target.value)}
              disabled={!canEdit}
              maxLength={32}
              className="text-sm py-1"
              aria-invalid={!colorValid}
            />
          </div>

          <div className="col-span-2">
            <label
              htmlFor="svqe-price"
              className="block text-xs font-medium text-text-secondary mb-1"
            >
              Precio (Bs)
            </label>
            <Input
              id="svqe-price"
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              value={draftPriceBs}
              onChange={(e) => setDraftPriceBs(e.target.value)}
              disabled={!canEdit}
              className="text-sm py-1"
              aria-invalid={!priceValid}
            />
            {!priceValid && <p className="text-[11px] text-status-danger mt-1">Precio inválido.</p>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Cantidad</span>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<Minus className="h-4 w-4" />}
              label="Restar"
              variant="secondary"
              size="sm"
              onClick={() => setDraftQty((v) => Math.max(0, v - 1))}
              disabled={!canEdit}
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={String(draftQty)}
              onChange={(e) => setDraftQty(Math.max(0, Number(e.target.value) || 0))}
              disabled={!canEdit}
              className="w-20 text-center text-sm py-1"
              aria-label="Cantidad"
            />
            <IconButton
              icon={<Plus className="h-4 w-4" />}
              label="Sumar"
              variant="secondary"
              size="sm"
              onClick={() => setDraftQty((v) => v + 1)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {canEdit && qtyIsDirty && (
          <Input
            type="text"
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            className="text-xs py-1"
          />
        )}

        {(submitError || adjustError) && (
          <Alert variant="error">{submitError ?? adjustError}</Alert>
        )}

        {canEdit && (
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={submitting || adjust.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<Save className="h-4 w-4" />}
              onClick={handleGuardarClick}
              isLoading={submitting || adjust.isPending}
              disabled={submitting || adjust.isPending || !anyDirty || !allValid}
            >
              Guardar
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        title="Confirmar edición de inventario"
        description={`Vas a modificar el stock de ${row.productName}. Esta acción queda registrada en el historial.`}
        requiresReason
        reasonMinLength={3}
        variant="default"
        isPending={submitting || adjust.isPending}
      />
    </Modal>
  );
}
