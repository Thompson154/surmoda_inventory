import { useState, type FormEvent } from 'react';
import type { Size, Variant } from '@surmoda/contracts';
import { Alert, Button } from '@/shared/ui';
import { SizeSelect } from './SizeSelect';
import { ColorInput } from './ColorInput';
import { PriceInput } from './PriceInput';
import { ImageUploader } from './ImageUploader';

interface VariantFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<Pick<Variant, 'size' | 'color' | 'priceCents' | 'imagePath'>>;
  isPending: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: VariantFormPayload) => void;
  onCancel?: () => void;
}

export interface VariantFormPayload {
  size: Size;
  color: string;
  priceCents: number;
  image: File | null;
}

export function VariantForm({
  mode,
  initialValues,
  isPending,
  errorMessage,
  onSubmit,
  onCancel,
}: VariantFormProps) {
  const [size, setSize] = useState<Size>(initialValues?.size ?? 'm');
  const [color, setColor] = useState(initialValues?.color ?? '');
  const [priceCents, setPriceCents] = useState(initialValues?.priceCents ?? 0);
  const [image, setImage] = useState<File | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({ size, color: color.trim(), priceCents, image });
  };

  const submitLabel = mode === 'create' ? 'Agregar variante' : 'Guardar cambios';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="flex gap-3">
        <div className="flex-1">
          <SizeSelect value={size} onChange={setSize} disabled={mode === 'edit'} />
        </div>
        <div className="flex-1">
          <ColorInput value={color} onChange={setColor} disabled={mode === 'edit'} />
        </div>
      </div>
      <PriceInput valueCents={priceCents} onChange={setPriceCents} />
      <ImageUploader currentImagePath={initialValues?.imagePath} onChange={setImage} />
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" isLoading={isPending} size="md">
          {isPending ? 'Guardando...' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
