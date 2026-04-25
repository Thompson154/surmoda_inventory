import type { Size } from '@surmoda/contracts';
import { SIZE_VALUES } from '@surmoda/contracts';
import { Field, Select } from '@/shared/ui';

interface SizeSelectProps {
  value: Size;
  onChange: (value: Size) => void;
  disabled?: boolean;
}

const SIZE_LABELS: Record<Size, string> = {
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
  xxl: 'XXL',
  '28': '28',
  '30': '30',
  '32': '32',
  '34': '34',
  standard: 'Estándar',
};

export function SizeSelect({ value, onChange, disabled = false }: SizeSelectProps) {
  return (
    <Field
      label="Talla"
      htmlFor="variant-size"
      hint={disabled ? 'La talla no se puede cambiar después de crear la variante.' : undefined}
    >
      <Select
        id="variant-size"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Size)}
      >
        {SIZE_VALUES.map((size) => (
          <option key={size} value={size}>
            {SIZE_LABELS[size]}
          </option>
        ))}
      </Select>
    </Field>
  );
}
