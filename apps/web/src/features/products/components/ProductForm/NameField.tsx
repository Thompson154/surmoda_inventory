import { Field, Input } from '@/shared/ui';

interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function NameField({ value, onChange }: NameFieldProps) {
  return (
    <Field label="Nombre" htmlFor="product-name">
      <Input
        id="product-name"
        type="text"
        required
        minLength={2}
        maxLength={120}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jean Bota Recta"
      />
    </Field>
  );
}
