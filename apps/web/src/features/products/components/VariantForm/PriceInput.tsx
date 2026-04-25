import { Field, Input } from '@/shared/ui';

interface PriceInputProps {
  /** Stored as integer cents; UI exposes a decimal entry. */
  valueCents: number;
  onChange: (valueCents: number) => void;
}

export function PriceInput({ valueCents, onChange }: PriceInputProps) {
  const display = valueCents > 0 ? (valueCents / 100).toFixed(2) : '';

  const handleChange = (raw: string) => {
    if (raw === '') {
      onChange(0);
      return;
    }
    const numeric = Number(raw);
    if (Number.isNaN(numeric) || numeric < 0) return;
    onChange(Math.round(numeric * 100));
  };

  return (
    <Field label="Precio (Bs.)" htmlFor="variant-price" hint="Hasta 2 decimales.">
      <Input
        id="variant-price"
        type="number"
        required
        min={0.01}
        max={100000}
        step={0.01}
        inputMode="decimal"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="250.00"
      />
    </Field>
  );
}
