import { Field, Input } from '@/shared/ui';

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ColorInput({ value, onChange, disabled = false }: ColorInputProps) {
  return (
    <Field
      label="Color"
      htmlFor="variant-color"
      hint={disabled ? 'El color no se puede cambiar después de crear la variante.' : undefined}
    >
      <Input
        id="variant-color"
        type="text"
        required
        minLength={1}
        maxLength={32}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="azul"
      />
    </Field>
  );
}
