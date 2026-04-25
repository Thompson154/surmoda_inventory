import { useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import type { InventoryRow } from '@surmoda/contracts';
import {
  Alert,
  Button,
  IconButton,
  Input,
  Modal,
} from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useStores } from '@/features/stores/hooks/useStores';
import { useInventory } from '@/features/inventory/hooks/useInventory';
import { useCreateDelivery } from '../hooks/useDeliveries';
import { getImageUrl } from '@/features/products/services/productsService';

interface NewDeliveryModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

interface CartItem {
  variantId: string;
  productCode: string;
  productName: string;
  size: string;
  color: string;
  imagePath?: string | null;
  quantity: number;
  /** Stock disponible en el origen (warehouse). Permite validar antes del POST. */
  available: number;
}

const SIZE_LABEL: Record<string, string> = {
  s: 'S', m: 'M', l: 'L', xl: 'XL', xxl: 'XXL', standard: 'Estándar',
};

export function NewDeliveryModal({ storeId, open, onClose }: NewDeliveryModalProps) {
  const stores = useStores();
  const targetStore = stores.data?.items.find((s) => s.id === storeId);
  const isReception = targetStore?.kind === 'warehouse';

  // Source for the picker:
  // - Distribution → list of variants currently in the warehouse (only)
  // - Reception → list of all variants from any store (we use the warehouse listing
  //   too because every variant has a stockBySite row with quantity ≥ 0)
  const warehouseStore = stores.data?.items.find((s) => s.kind === 'warehouse');
  const sourceStoreId = isReception
    ? warehouseStore?.id ?? storeId
    : warehouseStore?.id;

  const [q, setQ] = useState('');
  const inventory = useInventory(open ? sourceStoreId : undefined, {
    q: q || undefined,
    page: 1,
    pageSize: 30,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const create = useCreateDelivery(storeId);
  const errorMessage = useErrorMessage(create.error as HttpError | null | undefined);

  const totalUnits = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const reset = () => {
    setCart([]);
    setNote('');
    setQ('');
    setConfirmOpen(false);
    create.reset();
  };

  const handleClose = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  const addRow = (row: InventoryRow) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === row.variantId);
      if (existing) {
        // Cap at the available stock in the warehouse so the user can't oversell.
        const cap = isReception ? Number.POSITIVE_INFINITY : row.quantity;
        return prev.map((i) =>
          i.variantId === row.variantId
            ? { ...i, quantity: Math.min(cap, i.quantity + 1), available: row.quantity }
            : i,
        );
      }
      return [
        ...prev,
        {
          variantId: row.variantId,
          productCode: row.productCode,
          productName: row.productName,
          size: row.size,
          color: row.color,
          imagePath: row.imagePath,
          quantity: 1,
          available: row.quantity,
        },
      ];
    });
  };

  const updateQty = (variantId: string, qty: number) => {
    // WHY: typing/clearing the input must NEVER drop the row. Removal is explicit (Trash button).
    setCart((prev) =>
      prev.map((i) =>
        i.variantId === variantId
          ? {
              ...i,
              quantity: Math.max(
                0,
                isReception ? qty : Math.min(qty, i.available),
              ),
            }
          : i,
      ),
    );
  };

  const removeRow = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  // Items with quantity===0 are silently dropped from the payload — useful when the
  // user wants to keep editing one row at zero without losing it from the cart.
  const submit = () => {
    const toSend = cart.filter((i) => i.quantity > 0);
    if (toSend.length === 0) return;
    create.mutate(
      { items: toSend.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), note: note || undefined },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  const submittableUnits = useMemo(
    () => cart.filter((i) => i.quantity > 0).reduce((s, i) => s + i.quantity, 0),
    [cart],
  );

  return (
    <>
      <Modal isOpen={open && !confirmOpen} onClose={handleClose} title={isReception ? 'Nueva recepción' : 'Nueva entrega'}>
        <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-500">
            {isReception
              ? 'Agregá las variantes que llegaron al almacén.'
              : `Estás entregando desde el almacén a ${targetStore?.name ?? 'esta sede'}.`}
          </p>

          <Input
            type="search"
            placeholder="Buscar por código, nombre o barcode..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar variantes"
          />

          {inventory.data && (
            <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-lg border border-surface-border">
              {inventory.data.items.map((row) => {
                const url = getImageUrl(row.imagePath);
                return (
                  <li key={row.variantId}>
                    <button
                      type="button"
                      onClick={() => addRow(row)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken transition-colors"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden">
                        {url ? (
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate">
                          <span className="font-mono">{row.productCode}</span> ·{' '}
                          {SIZE_LABEL[row.size] ?? row.size} · <span className="capitalize">{row.color}</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">{row.productName}</p>
                      </div>
                      <span
                        className={`text-xs font-mono shrink-0 ${
                          row.quantity === 0
                            ? 'text-status-danger'
                            : row.quantity < 5
                            ? 'text-status-warning'
                            : 'text-slate-500'
                        }`}
                      >
                        Stock: {row.quantity}
                      </span>
                      <Plus className="h-4 w-4 text-slate-400 shrink-0" />
                    </button>
                  </li>
                );
              })}
              {inventory.data.items.length === 0 && (
                <li className="px-3 py-3 text-center text-xs text-slate-500">
                  Sin resultados.
                </li>
              )}
            </ul>
          )}

          <div className="border-t border-surface-border pt-3">
            <p className="text-sm font-medium text-slate-900 mb-2">Carrito ({totalUnits} unid.)</p>
            {cart.length === 0 ? (
              <p className="text-xs text-slate-500">Agregá variantes desde el listado de arriba.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {cart.map((i) => (
                  <li
                    key={i.variantId}
                    className="flex items-center gap-2 rounded-lg border border-surface-border px-2 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">
                        <span className="font-mono">{i.productCode}</span> ·{' '}
                        {SIZE_LABEL[i.size] ?? i.size} · <span className="capitalize">{i.color}</span>
                      </p>
                      {!isReception && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Disponible en almacén: {i.available}
                        </p>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={isReception ? undefined : i.available}
                      value={String(i.quantity)}
                      onChange={(e) => updateQty(i.variantId, Number(e.target.value) || 0)}
                      className={`w-16 text-center text-sm py-1 ${
                        i.quantity === 0 ? 'border-status-warning' : ''
                      }`}
                      aria-label="Cantidad"
                    />
                    <IconButton
                      icon={<Trash2 className="h-4 w-4" />}
                      label="Quitar"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(i.variantId)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Input
            type="text"
            placeholder="Nota (opcional): lote, observaciones..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            className="text-sm"
          />

          {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setConfirmOpen(true)}
            disabled={submittableUnits === 0}
          >
            Continuar
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={confirmOpen}
        onClose={() => !create.isPending && setConfirmOpen(false)}
        title="Confirmar entrega"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">
            Vas a {isReception ? 'recibir' : 'entregar'} <strong>{submittableUnits}</strong>{' '}
            unidad{submittableUnits === 1 ? '' : 'es'} en{' '}
            <strong>{targetStore?.name ?? '—'}</strong>.
          </p>
          <ul className="text-xs text-slate-600 max-h-40 overflow-y-auto">
            {cart
              .filter((i) => i.quantity > 0)
              .map((i) => (
                <li key={i.variantId} className="py-0.5">
                  · {i.productCode} {SIZE_LABEL[i.size] ?? i.size} {i.color} ×{' '}
                  <strong>{i.quantity}</strong>
                </li>
              ))}
          </ul>
          {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setConfirmOpen(false)}
              disabled={create.isPending}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={submit}
              isLoading={create.isPending}
              disabled={create.isPending}
            >
              Entregar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
