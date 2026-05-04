import { Plus, Trash2 } from 'lucide-react';
import type { Role } from '../../types';
import { Button, IconButton, Select } from '@/shared/ui';
import { useStores } from '@/features/stores/hooks/useStores';

export interface AssignmentDraft {
  storeId: string;
  role: Role;
}

interface AssignmentsDraftListProps {
  assignments: AssignmentDraft[];
  onUpdate: (idx: number, patch: Partial<AssignmentDraft>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

export function AssignmentsDraftList({
  assignments,
  onUpdate,
  onAdd,
  onRemove,
}: AssignmentsDraftListProps) {
  // WHY: only branches accept assignments (warehouse is admin-only).
  const stores = useStores({ kind: 'branch' });
  const items = stores.data?.items ?? [];

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-surface-border p-3">
      <legend className="text-sm font-medium text-text-secondary px-1">
        Asignaciones de tienda
      </legend>
      {assignments.map((a, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Select
            value={a.storeId}
            onChange={(e) => onUpdate(idx, { storeId: e.target.value })}
            className="flex-1 text-sm py-1"
          >
            {items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={a.role}
            onChange={(e) => onUpdate(idx, { role: e.target.value as Role })}
            fullWidth={false}
            className="text-sm py-1"
          >
            <option value="vendedora">vendedora</option>
            <option value="encargada">encargada</option>
          </Select>
          {assignments.length > 1 && (
            <IconButton
              icon={<Trash2 className="h-4 w-4" />}
              label={`Quitar asignación ${idx + 1}`}
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onRemove(idx)}
            />
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={onAdd}
        className="self-start"
      >
        Agregar otra tienda
      </Button>
    </fieldset>
  );
}
