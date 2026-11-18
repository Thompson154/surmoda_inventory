import { useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import type { InventoryRow } from '@surmoda/contracts';
import { useCreateDelivery } from '../hooks/useDeliveries';
import {
  Alert,
  Button,
  IconButton,
  Input,
  Modal,
  ProductCodeBadge,
  RequiredNote,
  Select,
} from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { HttpError } from '@/shared/services/httpClient';
import { useStores, useTransferDestinations } from '@/features/stores/hooks/useStores';
import { useInfiniteInventory } from '@/features/inventory/hooks/useInventory';
import { getImageUrl } from '@/features/products/services/productsService';
import { sizeLabel } from '@/shared/format/sizeLabel';

interface TransferToStoreModalProps {
  /** The sucursal de origen — current page's store. */
  fromStoreId: string;
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
  /** Stock disponible en la sede de origen. */
  available: number;
}

/**
 * Module 11 — initiate a lateral transfer (sucursal → otra sucursal) or a
 * return (sucursal → almacén). The encargada de origen chooses destination,
 * picks variants from her own inventory, and confirms.
 *
 * BE call: POST /stores/:toStoreId/deliveries body { fromStoreId, items, title }.
 * The delivery is born `sent` (status) and the destination's encargada/vendedora
 * receives it via the standard reception flow.
 */
export function TransferToStoreModal({ fromStoreId, open, onClose }: TransferToStoreModalProps) {
  const stores = useStores();
  const transferDestinations = useTransferDestinations(open);
  const availableStores = transferDestinations.data?.items ?? stores.data?.items ?? [];
  // Allowed destinations = active branches other than origin (never Almacén Central).
  const destinations = useMemo(
    () =>
      availableStores.filter((s) => s.id !== fromStoreId && s.isActive && s.kind !== 'warehouse'),
    [availableStores, fromStoreId],
  );
  const [toStoreId, setToStoreId] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 250);
  const inventory = useInfiniteInventory(open ? fromStoreId : undefined, {
    q: debouncedQ.trim() || undefined,
    pageSize: 10,
  });
  const loadedItems = useMemo(
    () => inventory.data?.pages.flatMap((p) => p.items) ?? [],
    [inventory.data?.pages],
  );
  const totalAvailable = inventory.data?.pages[0]?.total ?? 0;

  const [cart, setCart] = useState<CartItem[]>([]);
  const create = useCreateDelivery(toStoreId || fromStoreId);
  const errorMessage = useErrorMessage(create.error as HttpError | null | undefined);

  const totalUnits = cart.reduce((sum, c) => sum + c.quantity, 0);
  const transferBlockerReason = !toStoreId
    ? 'Selecciona una sede destino.'
    : cart.length === 0 || totalUnits === 0
      ? 'Agrega al menos 1 unidad para enviar.'
      : null;
  const canSubmit = transferBlockerReason === null && !create.isPending;

  function addToCart(row: InventoryRow) {
    if (row.quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === row.variantId);
      if (existing) {
        const next = Math.min(existing.available, existing.quantity + 1);
        return prev.map((i) => (i.variantId === row.variantId ? { ...i, quantity: next } : i));
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
  }

  function updateQty(variantId: string, n: number) {
    setCart((prev) =>
      prev.map((i) => {
        if (i.variantId !== variantId) return i;
        const safe = Math.max(0, Math.min(i.available, n));
        return { ...i, quantity: safe };
      }),
    );
  }

  function removeRow(variantId: string) {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  function reset() {
    setToStoreId('');
    setTitle('');
    setQ('');
    setCart([]);
    create.reset();
  }

  function submit() {
    if (!canSubmit) return;
    const items = cart
      .filter((c) => c.quantity > 0)
      .map((c) => ({ variantId: c.variantId, quantity: c.quantity }));
    if (items.length === 0) return;
    create.mutate(
      {
        fromStoreId,
        items,
        title: title.trim() || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Transferir a otra sede"
    >
      <div className="flex flex-col gap-3 max-h-[82vh]">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
          <RequiredNote />
          <div className="shrink-0">
            <label htmlFor="transfer-to" className="text-sm font-medium text-text-secondary">
              Sede destino
              <span aria-hidden="true" className="text-status-danger ml-0.5 font-semibold">
                *
              </span>
            </label>
            <Select
              id="transfer-to"
              value={toStoreId}
              onChange={(e) => setToStoreId(e.target.value)}
              className="mt-1"
              aria-label="Sede destino"
            >
              <option value="">— Elegir destino —</option>
              {destinations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="shrink-0">
            <label htmlFor="transfer-title" className="text-sm font-medium text-text-secondary">
              Título (opcional)
            </label>
            <Input
              id="transfer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="mt-1"
              placeholder="Envío o reposición entre sucursales..."
            />
          </div>

          <div className="shrink-0">
            <label htmlFor="transfer-search" className="text-sm font-medium text-text-secondary">
              Buscar variante en mi inventario
            </label>
            <Input
              id="transfer-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Código, nombre, color..."
              className="mt-1"
            />
          </div>

          {inventory.isLoading && <p className="text-xs text-text-muted shrink-0">Cargando…</p>}
          {inventory.data && (
            <div
              data-testid="transfer-inventory-picker"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (
                  el.scrollHeight - el.scrollTop - el.clientHeight < 40 &&
                  inventory.hasNextPage &&
                  !inventory.isFetchingNextPage
                ) {
                  void inventory.fetchNextPage();
                }
              }}
              className="shrink-0 flex flex-col gap-1 min-h-44 max-h-52 overflow-y-auto rounded border border-surface-border"
            >
              {loadedItems.length === 0 ? (
                <p className="text-xs text-text-muted px-3 py-2">Sin coincidencias.</p>
              ) : (
                <>
                  {loadedItems.map((row) => {
                    const src = getImageUrl(row.imagePath);
                    const disabled = row.quantity <= 0;
                    return (
                      <button
                        key={row.variantId}
                        type="button"
                        onClick={() => addToCart(row)}
                        disabled={disabled}
                        className={`shrink-0 flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed ${
                          cart.find((c) => c.variantId === row.variantId) ? 'bg-surface-sunken' : ''
                        }`}
                      >
                        <div className="h-9 w-9 shrink-0 rounded-md bg-surface-sunken flex items-center justify-center overflow-hidden">
                          {src ? (
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-text-subtle" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <ProductCodeBadge
                              code={row.productCode}
                              className="text-[11px] px-1.5 py-0"
                            />
                            <span className="text-xs text-text-muted truncate">
                              {row.productName}
                            </span>
                          </div>
                          <p className="text-sm truncate mt-0.5">
                            {sizeLabel(row.size)} · <span className="capitalize">{row.color}</span>
                          </p>
                        </div>
                        <span className="text-xs text-text-muted shrink-0">
                          {row.quantity} dispon.
                        </span>
                        <Plus className="h-4 w-4 text-text-subtle shrink-0" />
                      </button>
                    );
                  })}
                  <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-surface-border bg-surface-sunken/50 text-xs text-text-muted">
                    <span>
                      Mostrando {loadedItems.length} de {totalAvailable}
                    </span>
                    {inventory.hasNextPage && (
                      <button
                        type="button"
                        onClick={() => void inventory.fetchNextPage()}
                        disabled={inventory.isFetchingNextPage}
                        className="font-semibold text-brand-primary hover:underline disabled:opacity-50"
                      >
                        {inventory.isFetchingNextPage ? 'Cargando más...' : 'Cargar más'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {cart.length > 0 && (
            <div className="shrink-0 rounded border border-surface-border">
              <p className="text-xs font-semibold text-text-secondary px-3 py-2 border-b border-surface-border">
                A enviar ({totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'})
              </p>
              <ul className="max-h-44 overflow-y-auto">
                {cart.map((i) => (
                  <li
                    key={i.variantId}
                    className="flex items-center gap-2 px-3 py-2 border-b border-surface-border last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <ProductCodeBadge code={i.productCode} className="text-[11px] px-1.5 py-0" />
                      <p className="text-sm mt-0.5">
                        {sizeLabel(i.size)} · <span className="capitalize">{i.color}</span>
                      </p>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={i.available}
                      value={String(i.quantity)}
                      onChange={(e) => updateQty(i.variantId, Number(e.target.value) || 0)}
                      className="w-16 text-center text-xs py-1"
                      aria-label="Cantidad"
                    />
                    <span className="text-[10px] text-text-subtle shrink-0">/{i.available}</span>
                    <IconButton
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      label="Quitar"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(i.variantId)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-surface-border/60">
          {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={create.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={submit}
              isLoading={create.isPending}
              disabled={!canSubmit}
              className="flex-1"
            >
              Enviar transferencia
            </Button>
          </div>
          {transferBlockerReason && (
            <p className="text-xs text-text-muted text-right" role="status">
              {transferBlockerReason}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
