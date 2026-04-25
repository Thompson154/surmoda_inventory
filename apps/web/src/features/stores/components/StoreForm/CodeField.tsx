import { Field, Input } from '@/shared/ui';

interface CodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const CODE_HINT = 'Mayúsculas, números o guion bajo (ej: PRADO, ZSUR_2)';
const CODE_PATTERN = '[A-Z0-9_]{2,20}';

/**
 * Code field for store identifiers — auto-uppercases input as the user types.
 * Pattern + minLength enforced both client-side (HTML5) and server-side (Zod).
 */
export function CodeField({ value, onChange, disabled = false }: CodeFieldProps) {
  return (
    <Field label="Código" htmlFor="store-code" hint={CODE_HINT}>
      <Input
        id="store-code"
        type="text"
        required
        autoComplete="off"
        autoCapitalize="characters"
        minLength={2}
        maxLength={20}
        pattern={CODE_PATTERN}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="PRADO"
      />
    </Field>
  );
}
