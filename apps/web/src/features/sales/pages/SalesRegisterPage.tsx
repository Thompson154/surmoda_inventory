import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Banknote,
  Check,
  CreditCard,
  Image as ImageIcon,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import type { InventoryRow, PaymentMethod } from '@surmoda/contracts';
import {
  Alert,
  Button,
  Card,
  CardContent,
  IconButton,
  Input,
  Modal,
  Skeleton,
} from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useStores } from '@/features/stores/hooks/useStores';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useInventory } from '@/features/inventory/hooks/useInventory';
import { useCreateSale, useSales } from '../hooks/useSales';
import { AppShell } from '@/shared/layout/AppShell';
import type { BottomNavTab } from '@/shared/layout/BottomNav';
import { getImageUrl } from '@/features/products/services/productsService';

const SIZE_LABEL: Record<string, string> = {
  s: 'S', m: 'M', l: 'L', xl: 'XL', xxl: 'XXL', standard: 'Estándar',
};

interface CartItem {
  variantId: string;
  productCode: string;
  productName: string;
  size: string;
  color: string;
  imagePath?: string | null;
  priceCents: number;
  quantity: number;
  available: number;
}

function formatBs(cents: number): string {
  return `Bs. ${(cents / 100).toFixed(2)}`;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; Icon: typeof QrCode }> = [
  { value: 'qr', label: 'QR', Icon: QrCode },
  { value: 'card', label: 'Tarjeta', Icon: CreditCard },
  { value: 'cash', label: 'Efectivo', Icon: Banknote },
];

export function SalesRegisterPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId ?? '';
  const user = useAuthStore((s) => s.user);
  const stores = useStores();
  const store = stores.data?.items.find((s) => s.id === storeId);
  const isWarehouse = store?.kind === 'warehouse';

  const hasEncargadaRole = (user?.assignments ?? []).some((a) => a.role === 'encargada');
  const isAdmin = user?.isAdmin ?? false;
  const directRole = user?.assignments.find((a) => a.storeId === storeId)?.role;
  const isVendedoraHere = !isAdmin && !hasEncargadaRole && directRole === 'vendedora';

  const [q, setQ] = useState('');
  const inventory = useInventory(storeId, { q: q || undefined, page: 1, pageSize: 30 });
  const todayList = useSales(storeId, { page: 1, pageSize: 10 });
  const create = useCreateSale(storeId);
  const errorMessage = useErrorMessage(create.error as HttpError | null | undefined);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const total = useMemo(
    () => cart.reduce((s, i) => s + i.priceCents * i.quantity, 0),
    [cart],
  );
  const totalUnits = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const bottomNav = useMemo<BottomNavTab[]>(() => {
    const tabs: BottomNavTab[] = [
      { to: `/sedes/${storeId}/inventario`, label: 'Inventario', icon: 'inventario' },
      { to: `/sedes/${storeId}/entregas`, label: 'Entregas', icon: 'entregas' },
    ];
    if (!isWarehouse) {
      if (!isVendedoraHere) {
        tabs.push({ to: `/sedes/${storeId}/ventas`, label: 'Ventas', icon: 'ventas' });
      }
      tabs.push({ to: `/sedes/${storeId}/scanner`, label: 'Scanner', icon: 'scanner' });
    }
    return tabs;
  }, [storeId, isWarehouse, isVendedoraHere]);

  const addRow = (row: InventoryRow) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === row.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === row.variantId
            ? { ...i, quantity: Math.min(row.quantity, i.quantity + 1) }
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
          priceCents: row.priceCents,
          quantity: 1,
          available: row.quantity,
        },
      ];
    });
  };

  const updateQty = (variantId: string, qty: number) =>
    setCart((prev) =>
      prev.map((i) =>
        i.variantId === variantId
          ? { ...i, quantity: Math.max(0, Math.min(qty, i.available)) }
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
        items: toSend.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        paymentMethod,
      },
      {
        onSuccess: (sale) => {
          setCart([]);
          setConfirmOpen(false);
          setSuccessId(sale.id);
        },
      },
    );
  };

  return (
    <AppShell context={store?.name} bottomNav={bottomNav}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Registro de venta</h1>
          {totalUnits > 0 && (
            <span className="text-base font-semibold">{formatBs(total)}</span>
          )}
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar por código, nombre o barcode..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Buscar productos"
          />
        </div>

        {inventory.isLoading && <Skeleton className="h-32 w-full" />}

        {inventory.data && (
          <Card>
            <CardContent className="p-0 max-h-56 overflow-y-auto">
              <ul>
                {inventory.data.items.map((row) => {
                  const url = getImageUrl(row.imagePath);
                  return (
                    <li
                      key={row.variantId}
                      className="border-b border-surface-border last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => addRow(row)}
                        disabled={row.quantity === 0}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken transition-colors disabled:opacity-50"
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
                            {SIZE_LABEL[row.size] ?? row.size} ·{' '}
                            <span className="capitalize">{row.color}</span>
                          </p>
                          <p className="text-xs text-slate-500">{formatBs(row.priceCents)}</p>
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
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-medium">Carrito ({totalUnits})</p>
            {cart.length === 0 ? (
              <p className="text-xs text-slate-500">Tocá un producto del listado para agregarlo.</p>
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
                        {SIZE_LABEL[i.size] ?? i.size} ·{' '}
                        <span className="capitalize">{i.color}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatBs(i.priceCents)} · disponible {i.available}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={i.available}
                      value={String(i.quantity)}
                      onChange={(e) => updateQty(i.variantId, Number(e.target.value) || 0)}
                      className="w-16 text-center text-sm py-1"
                      aria-label="Cantidad"
                    />
                    <span className="text-xs font-mono shrink-0 w-20 text-right">
                      {formatBs(i.priceCents * i.quantity)}
                    </span>
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
          </CardContent>
        </Card>

        {cart.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm font-medium">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-3 text-sm transition-colors ${
                      paymentMethod === value
                        ? 'border-brand-primary bg-brand-primary-soft text-brand-primary'
                        : 'border-surface-border bg-surface-raised text-slate-700 hover:bg-surface-sunken'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setConfirmOpen(true)}
                disabled={total === 0}
                className="w-full"
              >
                Cobrar {formatBs(total)}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-medium">Ventas recientes</p>
            {todayList.isLoading && <Skeleton className="h-12 w-full" />}
            {todayList.data && todayList.data.items.length === 0 && (
              <p className="text-xs text-slate-500">Sin ventas todavía.</p>
            )}
            {todayList.data?.items.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-slate-900 truncate">{s.recordedByFullName}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleString('es-BO', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}{' '}
                    · {s.paymentMethod.toUpperCase()} · {s.totalUnits} u.
                  </p>
                </div>
                <span className="text-base font-semibold shrink-0">
                  {formatBs(s.totalCents)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Modal
          isOpen={confirmOpen}
          onClose={() => !create.isPending && setConfirmOpen(false)}
          title="Confirmar venta"
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              Total: <strong>{formatBs(total)}</strong> · Método:{' '}
              <strong>{paymentMethod.toUpperCase()}</strong>
            </p>
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
                Cobrar
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={successId !== null}
          onClose={() => setSuccessId(null)}
          title="Venta registrada"
        >
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="h-12 w-12 rounded-full bg-status-success-soft text-status-success flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-sm text-slate-700 text-center">
              Listo. Stock actualizado y movimiento registrado.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setSuccessId(null)}
              className="w-full"
            >
              OK
            </Button>
          </div>
        </Modal>
      </main>
    </AppShell>
  );
}
