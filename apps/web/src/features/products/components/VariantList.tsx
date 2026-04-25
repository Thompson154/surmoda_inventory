import { Image as ImageIcon, Power, RotateCcw } from 'lucide-react';
import type { Variant } from '@surmoda/contracts';
import { Badge, Button, Card, CardContent } from '@/shared/ui';
import { useDeactivateVariant, useReactivateVariant } from '../hooks/useProductsAdmin';
import { getImageUrl } from '../services/productsService';

interface VariantListProps {
  variants: Variant[];
}

const SIZE_LABELS: Record<string, string> = {
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
  xxl: 'XXL',
  standard: 'Estándar',
};

function formatPrice(cents: number): string {
  return `Bs. ${(cents / 100).toFixed(2)}`;
}

export function VariantList({ variants }: VariantListProps) {
  if (variants.length === 0) {
    return <p className="text-sm text-slate-500">Aún no hay variantes para este producto.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {variants.map((v) => (
        <VariantRow key={v.id} variant={v} />
      ))}
    </ul>
  );
}

function VariantRow({ variant }: { variant: Variant }) {
  const deactivate = useDeactivateVariant(variant.id);
  const reactivate = useReactivateVariant(variant.id);
  const imageUrl = getImageUrl(variant.imagePath);
  const sizeLabel = SIZE_LABELS[variant.size] ?? variant.size;

  return (
    <li>
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <div className="h-14 w-14 shrink-0 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={`${sizeLabel} ${variant.color}`} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{sizeLabel}</span>
              <span className="text-sm text-slate-500">·</span>
              <span className="text-sm text-slate-700 capitalize">{variant.color}</span>
              {!variant.isActive && <Badge variant="default">Inactiva</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{variant.barcode}</p>
            <p className="text-sm text-slate-700 mt-1">{formatPrice(variant.priceCents)}</p>
          </div>
          <div className="shrink-0">
            {variant.isActive ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                leftIcon={<Power className="h-3.5 w-3.5" />}
                onClick={() => deactivate.mutate()}
                isLoading={deactivate.isPending}
                disabled={deactivate.isPending}
              >
                Desactivar
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => reactivate.mutate()}
                isLoading={reactivate.isPending}
                disabled={reactivate.isPending}
              >
                Reactivar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
