import { Field, Input } from '@/shared/ui';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function PasswordField({ value, onChange }: PasswordFieldProps) {
  return (
    <Field label="Contraseña inicial (mín. 8 caracteres)" htmlFor="user-password">
      <Input
        id="user-password"
        type="text"
        required
        minLength={8}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
