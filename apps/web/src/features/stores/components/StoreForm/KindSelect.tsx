import type { StoreKind } from '@surmoda/contracts';
import { Field, Select } from '@/shared/ui';

interface KindSelectProps {
  value: StoreKind;
  onChange: (value: StoreKind) => void;
  disabled?: boolean;
}

/**
 * Kind selector. Disabled in edit mode — kind is immutable post-create
 * (changing warehouse↔branch invalidates downstream invariants in inventory features).
 */
export function KindSelect({ value, onChange, disabled = false }: KindSelectProps) {
  return (
    <Field
      label="Tipo"
      htmlFor="store-kind"
      hint={disabled ? 'El tipo no se puede cambiar después de crear la tienda.' : undefined}
    >
      <Select
        id="store-kind"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as StoreKind)}
      >
        <option value="branch">Sucursal</option>
        <option value="warehouse">Almacén central</option>
      </Select>
    </Field>
  );
}
