import { Button, Select } from '@/shared/ui';
import { useStores } from '../../hooks/useStores';
import type { Role } from '../../types';

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
  const stores = useStores();

  return (
    <fieldset className="flex flex-col gap-3 rounded border border-slate-200 p-3">
      <legend className="text-sm text-slate-700">Asignaciones de tienda</legend>
      {assignments.map((a, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Select
            value={a.storeId}
            onChange={(e) => onUpdate(idx, { storeId: e.target.value })}
            className="flex-1 text-sm py-1"
          >
            {stores.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(idx)}
              aria-label={`Quitar asignación ${idx + 1}`}
            >
              Quitar
            </Button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="self-start rounded border border-dashed border-slate-400 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
      >
        + Agregar otra tienda
      </button>
    </fieldset>
  );
}
