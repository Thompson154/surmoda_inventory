import { useEffect, useState } from 'react';
import { Image as ImageIcon, Minus, Plus, Save } from 'lucide-react';
import type { InventoryRow } from '@surmoda/contracts';
import { Alert, Badge, Button, IconButton, Input, Modal } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useAdjustQuantity } from '../hooks/useInventory';
import { getImageUrl } from '@/features/products/services/productsService';
import { formatBs as formatPrice } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';

interface SingleVariantQuickEditModalProps {
  storeId: string;
  row: InventoryRow | null;
  canEdit: boolean;
  onClose: () => void;
}

/**
 * Edits stock for ONE variant (resolved by barcode). Renders a compact form so the
 * encargada/vendedora doesn't have to scroll through every variant of the product.
 */
export function SingleVariantQuickEditModal({
  storeId,
  row,
  canEdit,
  onClose,
}: SingleVariantQuickEditModalProps) {
  const adjust = useAdjustQuantity(storeId);
  const [draft, setDraft] = useState(row?.quantity ?? 0);
  const [reason, setReason] = useState('');
  const errorMessage = useErrorMessage(adjust.error as HttpError | null | undefined);

  useEffect(() => {
    if (row) {
      setDraft(row.quantity);
      setReason('');
      adjust.reset();
    }
  }, [row?.variantId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!row) {
    return <Modal isOpen={false} onClose={onClose} title="Variante" children={null} />;
  }

  const isDirty = draft !== row.quantity;
  const label = sizeLabel(row.size);
  const imageUrl = getImageUrl(row.imagePath);

  const submit = () => {
    if (!canEdit || !isDirty) return;
    adjust.mutate(
      { variantId: row.variantId, payload: { quantity: draft, reason: reason || undefined } },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={`${row.productCode} · ${row.barcode}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-surface-border p-3">
          <div className="h-16 w-16 shrink-0 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{row.productName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {label} · <span className="capitalize">{row.color}</span>
            </p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{row.barcode}</p>
            <p className="text-xs text-slate-600 mt-1">{formatPrice(row.priceCents)}</p>
          </div>
          {!canEdit && <Badge variant="default">Solo lectura</Badge>}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">Cantidad</span>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<Minus className="h-4 w-4" />}
              label="Restar"
              variant="secondary"
              size="sm"
              onClick={() => setDraft((v) => Math.max(0, v - 1))}
              disabled={!canEdit}
            />
            <Input
              type="number"
              min={0}
              value={String(draft)}
              onChange={(e) => setDraft(Math.max(0, Number(e.target.value) || 0))}
              disabled={!canEdit}
              className="w-20 text-center text-sm py-1"
              aria-label="Cantidad"
            />
            <IconButton
              icon={<Plus className="h-4 w-4" />}
              label="Sumar"
              variant="secondary"
              size="sm"
              onClick={() => setDraft((v) => v + 1)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {canEdit && isDirty && (
          <Input
            type="text"
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            className="text-xs py-1"
          />
        )}

        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        {canEdit && (
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={adjust.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<Save className="h-4 w-4" />}
              onClick={submit}
              isLoading={adjust.isPending}
              disabled={adjust.isPending || !isDirty}
            >
              Guardar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
