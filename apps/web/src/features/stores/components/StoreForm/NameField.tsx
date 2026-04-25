import { Field, Input } from '@/shared/ui';

interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function NameField({ value, onChange }: NameFieldProps) {
  return (
    <Field label="Nombre" htmlFor="store-name">
      <Input
        id="store-name"
        type="text"
        required
        minLength={2}
        maxLength={80}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Sucursal Prado"
      />
    </Field>
  );
}
