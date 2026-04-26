import { useEffect, useState } from 'react';
import { Image as ImageIcon, Minus, Plus, Printer as PrinterIcon, Save } from 'lucide-react';
import { BarcodePrintModal } from './BarcodePrintModal';
import type { InventoryRow } from '@surmoda/contracts';
import { Alert, Badge, Button, IconButton, Input, Modal, Skeleton } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useAdjustQuantity } from '../hooks/useInventory';
import { useInventoryProductVariants } from '../hooks/useInventoryGrouped';
import { getImageUrl } from '@/features/products/services/productsService';
import { formatBs as formatPrice } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';

interface ProductDetailDrawerProps {
  storeId: string;
  productId: string | null;
  productName?: string;
  productCode?: string;
  canEdit: boolean;
  onClose: () => void;
}

export function ProductDetailDrawer({
  storeId,
  productId,
  productName,
  productCode,
  canEdit,
  onClose,
}: ProductDetailDrawerProps) {
  const open = productId !== null;
  const query = useInventoryProductVariants(open ? storeId : undefined, productId ?? undefined);

  // Derive a header from the first variant — every row of `items` shares
  // productCode/productName/imagePath/priceCents (the variants only differ on
  // size + color + stock), so showing them once at the top reduces noise.
  const head = query.data?.items[0] ?? null;
  const headerImage = head ? getImageUrl(head.imagePath) : null;
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={productName ? `${productCode ?? ''} · ${productName}` : 'Variantes'}
    >
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
        {query.isLoading && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}

        {query.isError && <Alert variant="error">No pudimos cargar las variantes.</Alert>}

        {head && (
          <div className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface-sunken p-3">
            <button
              type="button"
              onClick={() => headerImage && setZoomImage(headerImage)}
              disabled={!headerImage}
              className="h-16 w-16 shrink-0 rounded-md border border-surface-border bg-white flex items-center justify-center overflow-hidden disabled:cursor-default cursor-zoom-in"
              aria-label={headerImage ? 'Ampliar imagen' : 'Sin imagen'}
            >
              {headerImage ? (
                <img src={headerImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-slate-400" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-slate-500">{head.productCode}</p>
              <p className="text-base font-semibold text-slate-900 truncate">
                {formatPrice(head.priceCents)}
              </p>
              <p className="text-sm text-slate-600 truncate">{head.productName}</p>
            </div>
          </div>
        )}

        <Modal
          isOpen={zoomImage !== null}
          onClose={() => setZoomImage(null)}
          title="Imagen del producto"
        >
          {zoomImage && (
            <img
              src={zoomImage}
              alt=""
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg bg-slate-100"
            />
          )}
        </Modal>

        {head && (
          <p className="text-sm font-semibold text-slate-700 mt-1">Variantes</p>
        )}

        {query.data?.items.map((row) => (
          <VariantEditableRow
            key={row.variantId}
            storeId={storeId}
            row={row}
            canEdit={canEdit}
          />
        ))}
      </div>
    </Modal>
  );
}

interface VariantEditableRowProps {
  storeId: string;
  row: InventoryRow;
  canEdit: boolean;
}

function VariantEditableRow({ storeId, row, canEdit }: VariantEditableRowProps) {
  const adjust = useAdjustQuantity(storeId);
  const [draft, setDraft] = useState(row.quantity);
  const [reason, setReason] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const errorMessage = useErrorMessage(adjust.error as HttpError | null | undefined);

  useEffect(() => {
    setDraft(row.quantity);
  }, [row.quantity]);

  const isDirty = draft !== row.quantity;

  const submit = () => {
    if (!canEdit || !isDirty) return;
    adjust.mutate(
      { variantId: row.variantId, payload: { quantity: draft, reason: reason || undefined } },
      { onSuccess: () => setReason('') },
    );
  };

  const label = sizeLabel(row.size);

  return (
    <div className="rounded-lg border border-surface-border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">
            Talla {label} <span className="text-slate-400">·</span>{' '}
            <span className="capitalize">{row.color}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-semibold">{row.quantity}</span> disponibles · {' '}
            <span className="font-mono text-[10px] text-slate-400">{row.barcode}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPrintOpen(true)}
          className="text-xs font-semibold text-slate-700 hover:text-brand-strong inline-flex items-center gap-1 px-2 py-1 rounded border border-surface-border hover:bg-surface-sunken"
          aria-label="Imprimir código de barras"
        >
          <PrinterIcon className="h-3.5 w-3.5" />
          Código
        </button>
        {!canEdit && <Badge variant="default">Solo lectura</Badge>}
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          icon={<Minus className="h-4 w-4" />}
          label="Restar uno"
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
          label="Sumar uno"
          variant="secondary"
          size="sm"
          onClick={() => setDraft((v) => v + 1)}
          disabled={!canEdit}
        />
        {canEdit && isDirty && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Save className="h-3.5 w-3.5" />}
            onClick={submit}
            isLoading={adjust.isPending}
            disabled={adjust.isPending}
          >
            Guardar
          </Button>
        )}
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
      {errorMessage && <p className="text-xs text-status-danger">{errorMessage}</p>}

      <BarcodePrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        barcode={row.barcode}
        productCode={row.productCode}
        productName={row.productName}
        size={row.size}
        color={row.color}
      />
    </div>
  );
}
