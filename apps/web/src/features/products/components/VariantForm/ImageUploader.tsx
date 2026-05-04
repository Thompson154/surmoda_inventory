import { useEffect, useState } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { getImageUrl } from '../../services/productsService';
import { Field, IconButton } from '@/shared/ui';

interface ImageUploaderProps {
  /** Existing image path (relative or absolute) shown as the initial preview. */
  currentImagePath?: string | null;
  onChange: (file: File | null) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export function ImageUploader({ currentImagePath, onChange }: ImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(getImageUrl(currentImagePath));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(getImageUrl(currentImagePath));
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, currentImagePath]);

  const handleFile = (selected: File | null) => {
    if (!selected) {
      setFile(null);
      setError(null);
      onChange(null);
      return;
    }
    if (!ALLOWED.includes(selected.type)) {
      setError('Formato inválido. Solo PNG, JPG o WebP.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('La imagen supera 5 MB.');
      return;
    }
    setError(null);
    setFile(selected);
    onChange(selected);
  };

  return (
    <Field label="Imagen (opcional)" htmlFor="variant-image" error={error ?? undefined}>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 rounded-lg border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden">
          {preview ? (
            <img src={preview} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-text-subtle" />
          )}
        </div>
        <div className="flex-1 flex items-center gap-2">
          <label
            htmlFor="variant-image"
            className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-sunken cursor-pointer transition-colors duration-150"
          >
            <Upload className="h-4 w-4" />
            {file ? 'Cambiar' : 'Elegir imagen'}
          </label>
          <input
            id="variant-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {(file || currentImagePath) && (
            <IconButton
              icon={<X className="h-4 w-4" />}
              label="Quitar imagen"
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => handleFile(null)}
            />
          )}
        </div>
      </div>
    </Field>
  );
}
