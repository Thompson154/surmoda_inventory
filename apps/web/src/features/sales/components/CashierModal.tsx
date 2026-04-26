import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, QrCode, Trash2, X } from 'lucide-react';
import type { InventoryRow, PaymentMethod, SaleWithItems } from '@surmoda/contracts';
import { Alert, Button, IconButton, Input, Modal } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { httpClient } from '@/shared/services/httpClient';
import { formatBs } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';
import {
  BarcodeScanner,
  type BarcodeScannerHandle,
} from '@/shared/components/BarcodeScanner';
import { useCreateSale } from '../hooks/useSales';

interface CashierModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
  onSold: (sale: SaleWithItems) => void;
}

interface CartLine {
  variantId: string;
  productCode: string;
  size: string;
  color: string;
  unitPriceCents: number;
  quantity: number;
  /** Per-line subtotal AFTER discount, in cents. Defaults to quantity*unitPrice. */
  subtotalCents: number;
  available: number;
}


const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; Icon: typeof QrCode }> = [
  { value: 'card', label: 'Tarjeta', Icon: CreditCard },
  { value: 'qr', label: 'QR', Icon: QrCode },
  { value: 'cash', label: 'Efectivo', Icon: Banknote },
];

export function CashierModal({ storeId, open, onClose, onSold }: CashierModalProps) {
  const [code, setCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<BarcodeScannerHandle | null>(null);
  const create = useCreateSale(storeId);
  const errorMessage = useErrorMessage(create.error as HttpError | null | undefined);

  useEffect(() => {
    if (!open) {
      setCode('');
      setLookupError(null);
      setLookupPending(false);
      setCart([]);
      setPaymentMethod('cash');
      create.reset();
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // Intentionally only depends on `open`. Including `create` makes the
    // mutation reference change on every render and steal focus back to the
    // barcode input when the cashier clicks any cart cell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const subTotalCents = useMemo(
    () => cart.reduce((s, i) => s + i.subtotalCents, 0),
    [cart],
  );
  const grossTotalCents = useMemo(
    () => cart.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0),
    [cart],
  );

  const addByBarcode = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setLookupPending(true);
    setLookupError(null);
    try {
      const row = await httpClient.get<InventoryRow>(
        `/stores/${storeId}/inventory/by-barcode/${encodeURIComponent(trimmed)}`,
      );
      if (row.quantity <= 0) {
        setLookupError('Sin stock disponible para este código.');
        return;
      }
      setCart((prev) => {
        const existing = prev.find((i) => i.variantId === row.variantId);
        if (existing) {
          const newQty = Math.min(row.quantity, existing.quantity + 1);
          // Re-scale subtotal by the new quantity unless the user has manually edited it.
          const wasUntouched =
            existing.subtotalCents === existing.unitPriceCents * existing.quantity;
          return prev.map((i) =>
            i.variantId === row.variantId
              ? {
                  ...i,
                  quantity: newQty,
                  subtotalCents: wasUntouched
                    ? row.priceCents * newQty
                    : i.subtotalCents,
                }
              : i,
          );
        }
        return [
          ...prev,
          {
            variantId: row.variantId,
            productCode: row.productCode,
            size: row.size,
            color: row.color,
            unitPriceCents: row.priceCents,
            quantity: 1,
            subtotalCents: row.priceCents,
            available: row.quantity,
          },
        ];
      });
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const isNotFound = e.code === 'STOCK_BARCODE_NOT_FOUND';
      setLookupError(
        isNotFound
          ? 'Código no encontrado en esta sede.'
          : e.message ?? 'No pudimos verificar el código.',
      );
      // Block the scanner from re-firing the same not-found code on every poll
      // (~120ms) — gives the cashier time to react and move the camera away.
      scannerRef.current?.markHandled(trimmed, isNotFound ? 10_000 : 5_000);
    } finally {
      setLookupPending(false);
    }
  };

  const updateQty = (variantId: string, qty: number) =>
    setCart((prev) =>
      prev.map((i) => {
        if (i.variantId !== variantId) return i;
        const safeQty = Math.max(0, Math.min(qty, i.available));
        const wasUntouched = i.subtotalCents === i.unitPriceCents * i.quantity;
        return {
          ...i,
          quantity: safeQty,
          subtotalCents: wasUntouched ? i.unitPriceCents * safeQty : i.subtotalCents,
        };
      }),
    );

  const updateSubtotal = (variantId: string, valueBs: number) =>
    setCart((prev) =>
      prev.map((i) =>
        i.variantId === variantId
          ? { ...i, subtotalCents: Math.max(0, Math.round(valueBs * 100)) }
          : i,
      ),
    );

  const removeRow = (variantId: string) =>
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));

  const submit = () => {
    const toSend = cart.filter((i) => i.quantity > 0);
    if (toSend.length === 0) return;
    create.mutate(
      {
        items: toSend.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          subtotalCents: i.subtotalCents,
        })),
        paymentMethod,
      },
      { onSuccess: (sale) => onSold(sale) },
    );
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Registro de venta">
      <div className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
        <BarcodeScanner
          handleRef={scannerRef}
          hint="Apuntá al código del producto"
          onDetected={(c) => void addByBarcode(c)}
        />

        <div>
          <label htmlFor="cashier-code" className="text-sm font-medium text-slate-700">
            Agregá el código de barra
          </label>
          <div className="mt-1 flex gap-2">
            <Input
              id="cashier-code"
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addByBarcode(code);
              }}
              placeholder="Pegá o escribí el código..."
              className="font-mono uppercase"
              autoComplete="off"
              autoCapitalize="characters"
              disabled={lookupPending}
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void addByBarcode(code)}
              isLoading={lookupPending}
              disabled={!code.trim() || lookupPending}
            >
              Agregar
            </Button>
          </div>
        </div>

        {lookupError && <Alert variant="error">{lookupError}</Alert>}

        {/* Payment-method pills + running subtotal */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {PAYMENT_METHODS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPaymentMethod(value)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  paymentMethod === value
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-sunken text-slate-600 hover:bg-surface-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="text-sm">
            <span className="text-slate-500">SubTotal</span>{' '}
            <span className="font-semibold text-slate-900">{formatBs(subTotalCents)}</span>
          </div>
        </div>

        {/* Cart table */}
        {cart.length === 0 ? (
          <p className="text-xs text-center text-slate-500 py-4">
            Agregá productos al carrito escaneando o pegando el código.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-surface-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-sunken text-slate-600">
                <tr>
                  <th className="text-left px-2 py-2">Talla / Color</th>
                  <th className="text-right px-2 py-2">Cantidad</th>
                  <th className="text-right px-2 py-2">Total</th>
                  <th className="text-right px-2 py-2">SubTotal</th>
                  <th className="px-1 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((i) => (
                  <tr key={i.variantId} className="border-t border-surface-border">
                    <td className="px-2 py-2">
                      <p className="font-mono text-[10px] text-slate-500">{i.productCode}</p>
                      <p>
                        {sizeLabel(i.size)}{' '}
                        <span className="text-slate-400 capitalize">· {i.color}</span>
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={i.available}
                        value={String(i.quantity)}
                        onChange={(e) => updateQty(i.variantId, Number(e.target.value) || 0)}
                        className="w-14 text-center text-xs py-1"
                        aria-label="Cantidad"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {formatBs(i.unitPriceCents * i.quantity)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={(i.subtotalCents / 100).toFixed(2)}
                        onChange={(e) =>
                          updateSubtotal(i.variantId, Number(e.target.value) || 0)
                        }
                        className="w-20 text-right text-xs py-1 font-mono"
                        aria-label="SubTotal"
                      />
                    </td>
                    <td className="px-1 py-2 text-right">
                      <IconButton
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label="Quitar"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(i.variantId)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {grossTotalCents > 0 && grossTotalCents !== subTotalCents && (
          <p className="text-[11px] text-slate-500 text-right">
            Bruto: {formatBs(grossTotalCents)} · Descuento:{' '}
            {formatBs(grossTotalCents - subTotalCents)}
          </p>
        )}

        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={create.isPending}
            leftIcon={<X className="h-4 w-4" />}
          >
            Cerrar venta
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={submit}
            isLoading={create.isPending}
            disabled={create.isPending || subTotalCents === 0}
            className="flex-1"
          >
            Cobrar {formatBs(subTotalCents)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
