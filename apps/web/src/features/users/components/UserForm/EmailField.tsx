import { Field, Input } from '@/shared/ui';

interface EmailFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function EmailField({ value, onChange }: EmailFieldProps) {
  return (
    <Field label="Email" htmlFor="user-email">
      <Input
        id="user-email"
        type="email"
        required
        autoComplete="off"
        inputMode="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
