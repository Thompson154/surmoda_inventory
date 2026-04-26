import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import type { WarehouseIntakeVariantPayload } from '@surmoda/contracts';
import {
  Alert,
  Button,
  IconButton,
  Input,
  Modal,
} from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import {
  useWarehouseIntake,
  useWarehouseIntakeLookup,
} from '../hooks/useDeliveries';
import { sizeLabel } from '@/shared/format/sizeLabel';
import { formatBs } from '@/shared/format/currency';
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
  quantity: number;
  priceCents: number;
  /** Local preview URL (revoked on cleanup). */
  previewUrl: string | null;
  /** Base64 data URL ready for the BE. */
  imageBase64: string | null;
  /** True when this row matches an existing variant — disables price + image edits. */
  matchesExisting: boolean;
  existingVariantId: string | null;
  existingWarehouseQuantity: number;
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
  const [title, setTitle] = useState('');
  const [variants, setVariants] = useState<DraftVariant[]>([emptyVariant()]);

  const upperCode = code.trim().toUpperCase();
  const lookup = useWarehouseIntakeLookup(open ? warehouseId : undefined, upperCode);
  const intake = useWarehouseIntake(warehouseId);
  const errorMsg = useErrorMessage(intake.error as HttpError | null);

  // When the lookup result lands, mark variants whose (size,color) match an
  // existing one. We don't override what the operator typed — just lock the
  // price field and surface a "ya existe" hint.
  useEffect(() => {
    if (!lookup.data) return;
    setVariants((prev) =>
      prev.map((v) => {
        const match = lookup.data?.variants.find(
          (e) =>
            e.size === v.size &&
            e.color.trim().toLowerCase() === v.color.trim().toLowerCase(),
        );
        if (!match) {
          return {
            ...v,
            matchesExisting: false,
            existingVariantId: null,
            existingWarehouseQuantity: 0,
          };
        }
        return {
          ...v,
          matchesExisting: true,
          existingVariantId: match.variantId,
          existingWarehouseQuantity: match.warehouseQuantity,
          // Snap price to the live value so the operator sees what's locked in.
          priceCents: match.priceCents,
        };
      }),
    );
  }, [lookup.data]);

  // When the modal closes, blow away local preview URLs to avoid leaks.
  useEffect(() => {
    if (open) return;
    for (const v of variants) {
      if (v.previewUrl) URL.revokeObjectURL(v.previewUrl);
    }
    setCode('');
    setProductName('');
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
    if (file.size > 5 * 1024 * 1024) return; // Hard match BE limit
    const previous = variants[idx]?.previewUrl;
    if (previous) URL.revokeObjectURL(previous);
    const previewUrl = URL.createObjectURL(file);
    const imageBase64 = await readFileAsDataUrl(file);
    updateVariant(idx, { previewUrl, imageBase64 });
  };

  const submit = () => {
    const valid = variants.every(
      (v) =>
        v.color.trim().length > 0 &&
        v.quantity > 0 &&
        (v.matchesExisting || v.priceCents > 0),
    );
    if (!valid) return;
    if (!upperCode) return;

    intake.mutate(
      {
        productCode: upperCode,
        productName: productName.trim() || undefined,
        title: title.trim() || undefined,
        variants: variants.map((v) => ({
          size: v.size,
          color: v.color.trim(),
          quantity: v.quantity,
          priceCents: v.priceCents,
          // Sólo enviamos la imagen si la variante es nueva (matchesExisting=false).
          // Si ya existe, el BE igual ignora salvo que imagePath sea null, pero
          // para reposiciones evitamos la transferencia.
          imageBase64: v.matchesExisting ? null : v.imageBase64,
        })),
      },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  const exists = lookup.data?.exists ?? false;

  return (
    <Modal isOpen={open} onClose={onClose} title="Entrega de mercadería">
      <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
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
                ? `Modelo "${lookup.data.productName ?? upperCode}" ya existe — se sumará stock.`
                : 'Código nuevo — se creará el modelo.'}
            </p>
          )}
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

        {/* Title */}
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
            <p className="text-sm font-semibold">
              Variantes · {variants.length}
            </p>
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
              const liveImage = v.previewUrl
                ?? (v.matchesExisting && v.existingVariantId
                  ? getImageUrl(
                      lookup.data?.variants.find((e) => e.variantId === v.existingVariantId)?.imagePath ?? null,
                    )
                  : null);
              return (
                <li
                  key={idx}
                  className="rounded-lg border border-surface-border bg-white p-3 flex flex-col gap-2"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Cantidad
                      </p>
                      <Input
                        type="number"
                        min={1}
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
                        onChange={(e) =>
                          updateVariant(idx, { size: e.target.value as SizeKey })
                        }
                        className="mt-0.5 w-full rounded-md border border-surface-border bg-white text-sm py-1 px-2"
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
                        className="text-sm py-1 mt-0.5"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Precio {v.matchesExisting ? '(actual)' : '(Bs)'}
                      </p>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={(v.priceCents / 100).toFixed(2)}
                        onChange={(e) =>
                          updateVariant(idx, {
                            priceCents: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)),
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
                          }}
                        />
                      </div>
                    </label>

                    {v.matchesExisting && (
                      <p className="text-[11px] text-slate-500">
                        Existe en almacén · {v.existingWarehouseQuantity} u.
                      </p>
                    )}

                    <div className="ml-auto">
                      <IconButton
                        icon={<Trash2 className="h-4 w-4" />}
                        label="Quitar"
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

        {/* Footer summary */}
        <div className="flex items-center justify-between rounded-lg bg-violet-50 text-violet-700 px-3 py-2">
          <span className="text-sm font-semibold">Total prendas</span>
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
              variants.length === 0 ||
              variants.some((v) => v.color.trim().length === 0 || v.quantity <= 0)
            }
          >
            Entregar {totalUnits > 0 && `· ${totalUnits} prenda${totalUnits === 1 ? '' : 's'}`}
          </Button>
        </div>
        {/* Hint usage of the existing-warehouse summary so non-empty lookups
            never feel "ghosted" — always show what's currently in store. */}
        {exists && lookup.data && lookup.data.variants.length > 0 && (
          <details className="rounded border border-surface-border bg-surface-sunken px-3 py-2">
            <summary className="text-xs font-semibold text-slate-700 cursor-pointer">
              Variantes actuales en almacén ({lookup.data.variants.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {lookup.data.variants.map((e) => (
                <li key={e.variantId} className="flex items-center justify-between">
                  <span>
                    {sizeLabel(e.size)} · <span className="capitalize">{e.color}</span>
                  </span>
                  <span className="font-mono text-slate-500">
                    {formatBs(e.priceCents)} · {e.warehouseQuantity} u.
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  );
}
