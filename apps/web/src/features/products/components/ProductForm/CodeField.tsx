import { Field, Input } from '@/shared/ui';

interface CodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const CODE_HINT = 'Mayúsculas, números o guion bajo (ej: JN001)';

export function CodeField({ value, onChange, disabled = false }: CodeFieldProps) {
  return (
    <Field label="Código" htmlFor="product-code" hint={CODE_HINT}>
      <Input
        id="product-code"
        type="text"
        required
        autoComplete="off"
        autoCapitalize="characters"
        minLength={2}
        maxLength={15}
        pattern="[A-Z0-9_]{2,15}"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="JN001"
      />
    </Field>
  );
}
