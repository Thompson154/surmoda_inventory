import { useEffect, useState, type FormEvent } from 'react';
import type { Role } from '../../types';
import { Button, Field, Select } from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';

interface AddAssignmentFormProps {
  isPending: boolean;
  onAdd: (storeId: string, role: Role) => void;
}

export function AddAssignmentForm({ isPending, onAdd }: AddAssignmentFormProps) {
  const stores = useStores({ kind: 'branch' });
  const items = stores.data?.items ?? [];
  const firstStoreId = items[0]?.id ?? '';

  const [storeId, setStoreId] = useState(firstStoreId);
  const [role, setRole] = useState<Role>('vendedora');

  // Initialize selection once stores have loaded.
  useEffect(() => {
    if (firstStoreId && !storeId) setStoreId(firstStoreId);
  }, [firstStoreId, storeId]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!storeId) return;
    onAdd(storeId, role);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded border border-dashed border-slate-300 p-3"
    >
      <div className="flex flex-1 flex-col gap-1">
        <Field label="Tienda" htmlFor="add-assignment-store">
          <Select
            id="add-assignment-store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="text-sm py-1"
          >
            {items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-col gap-1">
        <Field label="Rol" htmlFor="add-assignment-role">
          <Select
            id="add-assignment-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            fullWidth={false}
            className="text-sm py-1"
          >
            <option value="vendedora">vendedora</option>
            <option value="encargada">encargada</option>
          </Select>
        </Field>
      </div>
      <Button type="submit" isLoading={isPending} size="md">
        {isPending ? 'Agregando...' : '+ Agregar'}
      </Button>
    </form>
  );
}
