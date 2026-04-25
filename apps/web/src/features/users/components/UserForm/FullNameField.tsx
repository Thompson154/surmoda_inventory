import { Field, Input } from '@/shared/ui';

interface FullNameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function FullNameField({ value, onChange }: FullNameFieldProps) {
  return (
    <Field label="Nombre completo" htmlFor="user-fullname">
      <Input
        id="user-fullname"
        type="text"
        required
        minLength={1}
        maxLength={120}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
