import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import type { WarehouseIntakeVariantPayload } from '@surmoda/contracts';
import { useWarehouseIntake, useWarehouseIntakeLookup } from '../hooks/useDeliveries';
import { Alert, Button, IconButton, Input, Modal } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { sizeLabel } from '@/shared/format/sizeLabel';
import { formatBsShort } from '@/shared/format/currency';
import { getImageUrl } from '@/features/products/services/productsService';

interface WarehouseIntakeModalProps {
  warehouseId: string;
  open: boolean;
  onClose: () => void;
}

type SizeKey = WarehouseIntakeVariantPayload['size'];

const SIZE_OPTIONS: SizeKey[] = ['s', 'm', 'l', 'xl', 'xxl', '28', '30', '32', '34', 'standard'];

interface DraftVariant {
  size: SizeKey;
  color: string;
  /** Quantity to add. For existing variants this is "extra units arriving"; for
   *  new variants this is the initial stock. */
  quantity: number;
  /** Price in cents (integers — no decimals). Locked when variant exists. */
  priceCents: number;
  previewUrl: string | null;
  imageBase64: string | null;
  matchesExisting: boolean;
  existingVariantId: string | null;
  existingWarehouseQuantity: number;
  existingImagePath: string | null;
}

function emptyVariant(): DraftVariant {
  return {
    size: 'm',
    color: '',
    quantity: 1,
    priceCents: 0,
    previewUrl: null,
    imageBase64: null,
    matchesExisting: false,
    existingVariantId: null,
    existingWarehouseQuantity: 0,
    existingImagePath: null,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

export function WarehouseIntakeModal({ warehouseId, open, onClose }: WarehouseIntakeModalProps) {
  const [code, setCode] = useState('');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [title, setTitle] = useState('');
  const [variants, setVariants] = useState<DraftVariant[]>([emptyVariant()]);

  const upperCode = code.trim().toUpperCase();
  const lookup = useWarehouseIntakeLookup(open ? warehouseId : undefined, upperCode);
  const intake = useWarehouseIntake(warehouseId);
  const errorMsg = useErrorMessage(intake.error as HttpError | null);

  // When the lookup lands and the model exists, prefill the variant list with
  // every existing variant (quantity=0 by default — the operator just sums on
  // top). New rows the operator adds remain "alta de variante nueva".
  useEffect(() => {
    if (!lookup.data) return;
    const data = lookup.data;
    if (!data.exists) {
      // New model — wipe matches if any.
      setVariants((prev) =>
        prev.map((v) => ({
          ...v,
          matchesExisting: false,
          existingVariantId: null,
          existingWarehouseQuantity: 0,
          existingImagePath: null,
        })),
      );
      return;
    }
    // Build a fresh list: one row per existing variant, then keep any extra
    // user-added rows that didn't match (e.g. brand new size+color combos).
    setVariants((prev) => {
      const incoming: DraftVariant[] = data.variants.map((e) => ({
        size: e.size as SizeKey,
        color: e.color,
        quantity: 0,
        priceCents: e.priceCents,
        previewUrl: null,
        imageBase64: null,
        matchesExisting: true,
        existingVariantId: e.variantId,
        existingWarehouseQuantity: e.warehouseQuantity,
        existingImagePath: e.imagePath,
      }));
      // Carry user-added rows whose (size, color) is NOT among existing ones.
      const existingKeys = new Set(
        data.variants.map((e) => `${e.size}|${e.color.trim().toLowerCase()}`),
      );
      const extras = prev.filter(
        (v) =>
          !v.matchesExisting &&
          v.color.trim() !== '' &&
          !existingKeys.has(`${v.size}|${v.color.trim().toLowerCase()}`),
      );
      return [...incoming, ...extras];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.data?.productId, lookup.data?.exists]);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (open) return;
    for (const v of variants) {
      if (v.previewUrl) URL.revokeObjectURL(v.previewUrl);
    }
    setCode('');
    setProductName('');
    setProductDescription('');
    setTitle('');
    setVariants([emptyVariant()]);
    intake.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalUnits = useMemo(
    () => variants.reduce((sum, v) => sum + Math.max(0, v.quantity), 0),
    [variants],
  );

  const updateVariant = (idx: number, patch: Partial<DraftVariant>) =>
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  const addVariant = () => setVariants((prev) => [...prev, emptyVariant()]);

  const removeVariant = (idx: number) => {
    setVariants((prev) => {
      const removed = prev[idx];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleImage = async (idx: number, file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    const previous = variants[idx]?.previewUrl;
    if (previous) URL.revokeObjectURL(previous);
    const previewUrl = URL.createObjectURL(file);
    const imageBase64 = await readFileAsDataUrl(file);
    updateVariant(idx, { previewUrl, imageBase64 });
  };

  const clearImage = (idx: number) => {
    const previous = variants[idx]?.previewUrl;
    if (previous) URL.revokeObjectURL(previous);
    updateVariant(idx, { previewUrl: null, imageBase64: null });
  };

  const submit = () => {
    // Drop variants the operator left at 0 — they don't represent stock to add.
    const nonZero = variants.filter((v) => v.quantity > 0);
    if (nonZero.length === 0) return;
    const valid = nonZero.every(
      (v) => v.color.trim().length > 0 && (v.matchesExisting || v.priceCents > 0),
    );
    if (!valid) return;
    if (!upperCode) return;

    intake.mutate(
      {
        productCode: upperCode,
        productName: productName.trim() || undefined,
        productDescription: productDescription.trim() || undefined,
        title: title.trim() || undefined,
        variants: nonZero.map((v) => ({
          size: v.size,
          color: v.color.trim(),
          quantity: v.quantity,
          priceCents: v.priceCents,
          imageBase64: v.matchesExisting ? null : v.imageBase64,
        })),
      },
      { onSuccess: () => onClose() },
    );
  };

  const exists = lookup.data?.exists ?? false;

  return (
    <Modal isOpen={open} onClose={onClose} title="Entrega de mercadería">
      <div className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
        {/* Code */}
        <div>
          <label htmlFor="intake-code" className="text-sm font-semibold block">
            Código de modelo
          </label>
          <Input
            id="intake-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="p. ej. JN001"
            maxLength={15}
            className="font-mono uppercase mt-1"
            autoCapitalize="characters"
          />
          {upperCode.length >= 2 && lookup.data && (
            <p className="text-xs mt-1 text-slate-600">
              {exists
                ? `Modelo "${lookup.data.productName ?? upperCode}" ya existe — variantes pre-cargadas para sumar stock.`
                : 'Código nuevo — se creará el modelo.'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="intake-desc" className="text-sm font-semibold block">
            Descripción del modelo <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <Input
            id="intake-desc"
            type="text"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="Ej: Jean clásico bota recta, denim azul"
            maxLength={500}
            className="mt-1"
          />
          <p className="text-[11px] text-slate-500 mt-0.5">
            Aparece en búsquedas además del código.
          </p>
        </div>

        {!exists && upperCode.length >= 2 && (
          <div>
            <label htmlFor="intake-name" className="text-sm font-semibold block">
              Nombre del modelo
            </label>
            <Input
              id="intake-name"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ej: Jean clásico bota recta"
              maxLength={120}
              className="mt-1"
            />
          </div>
        )}

        <div>
          <label htmlFor="intake-title" className="text-sm font-semibold block">
            Título de la entrega
          </label>
          <Input
            id="intake-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Ej: "Mercadería nueva de Chile"'
            maxLength={80}
            className="mt-1"
          />
        </div>

        {/* Variants */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Variantes · {variants.length}</p>
            <button
              type="button"
              onClick={addVariant}
              className="text-xs font-semibold text-brand-strong hover:underline inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar variante
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {variants.map((v, idx) => {
              const liveImage =
                v.previewUrl ?? (v.matchesExisting ? getImageUrl(v.existingImagePath) : null);
              const hasOwnImage = v.previewUrl !== null;
              return (
                <li
                  key={`${v.matchesExisting ? `e-${v.existingVariantId}` : `n-${idx}`}`}
                  className="rounded-lg border border-surface-border bg-white p-3 flex flex-col gap-2"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        {v.matchesExisting ? 'Sumar' : 'Cantidad'}
                      </p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={String(v.quantity)}
                        onChange={(e) =>
                          updateVariant(idx, { quantity: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="text-sm py-1 mt-0.5"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Talla</p>
                      <select
                        value={v.size}
                        onChange={(e) => updateVariant(idx, { size: e.target.value as SizeKey })}
                        disabled={v.matchesExisting}
                        className="mt-0.5 w-full rounded-md border border-surface-border bg-white text-sm py-1 px-2 disabled:bg-surface-sunken"
                      >
                        {SIZE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {sizeLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Color</p>
                      <Input
                        type="text"
                        value={v.color}
                        onChange={(e) => updateVariant(idx, { color: e.target.value })}
                        placeholder="Azul"
                        maxLength={32}
                        disabled={v.matchesExisting}
                        className="text-sm py-1 mt-0.5"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Precio {v.matchesExisting ? '(actual)' : 'Bs'}
                      </p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={String(Math.round(v.priceCents / 100))}
                        onChange={(e) =>
                          updateVariant(idx, {
                            priceCents: Math.max(0, Math.round(Number(e.target.value) || 0)) * 100,
                          })
                        }
                        disabled={v.matchesExisting}
                        className="text-sm py-1 mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 flex flex-col gap-1">
                      Imagen
                      <div className="h-12 w-12 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden cursor-pointer relative">
                        {liveImage ? (
                          <img src={liveImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-400" />
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            void handleImage(idx, e.target.files?.[0] ?? null);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </label>

                    {hasOwnImage && (
                      <button
                        type="button"
                        onClick={() => clearImage(idx)}
                        className="text-[11px] text-rose-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        <X className="h-3 w-3" />
                        Quitar imagen
                      </button>
                    )}

                    {v.matchesExisting && (
                      <p className="text-[11px] text-slate-500">
                        Existe en almacén · {v.existingWarehouseQuantity} u.
                      </p>
                    )}

                    <div className="ml-auto">
                      <IconButton
                        icon={<Trash2 className="h-4 w-4" />}
                        label="Quitar fila"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(idx)}
                        disabled={variants.length <= 1}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-violet-50 text-violet-700 px-3 py-2">
          <span className="text-sm font-semibold">Total prendas a sumar</span>
          <span className="text-2xl font-bold">{totalUnits}</span>
        </div>

        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={submit}
            isLoading={intake.isPending}
            disabled={
              intake.isPending ||
              upperCode.length < 2 ||
              totalUnits === 0 ||
              variants.some(
                (v) =>
                  v.quantity > 0 &&
                  (v.color.trim().length === 0 || (!v.matchesExisting && v.priceCents <= 0)),
              )
            }
          >
            Entregar {totalUnits > 0 && `· ${totalUnits} u.`}
          </Button>
        </div>

        {exists && lookup.data && lookup.data.variants.length > 0 && (
          <p className="text-[11px] text-slate-500 text-center">
            Stock total actual del modelo en almacén:{' '}
            {lookup.data.variants.reduce((s, v) => s + v.warehouseQuantity, 0)} prendas en{' '}
            {lookup.data.variants.length} variantes
            {lookup.data.variants.some((v) => v.priceCents) &&
              ` · precios desde ${formatBsShort(Math.min(...lookup.data.variants.map((v) => v.priceCents)))}`}
            .
          </p>
        )}
      </div>
    </Modal>
  );
}
