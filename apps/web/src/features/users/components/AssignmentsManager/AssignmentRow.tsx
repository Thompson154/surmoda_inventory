import { Button, Select } from '@/shared/ui';
import { getStoreLabel } from '../../hooks/useStores';
import type { Assignment, Role } from '../../types';

interface AssignmentRowProps {
  assignment: Assignment;
  isConfirmingRemove: boolean;
  isChangingRole: boolean;
  isRemoving: boolean;
  onChangeRole: (assignmentId: string, role: Role) => void;
  onRemoveClick: (assignmentId: string) => void;
  onConfirmRemove: (assignmentId: string) => void;
  onCancelRemove: () => void;
}

export function AssignmentRow({
  assignment,
  isConfirmingRemove,
  isChangingRole,
  isRemoving,
  onChangeRole,
  onRemoveClick,
  onConfirmRemove,
  onCancelRemove,
}: AssignmentRowProps) {
  const storeLabel = getStoreLabel(assignment.storeId);

  return (
    <li className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{storeLabel}</span>
        <span className="text-xs text-slate-500">{assignment.storeId}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={assignment.role}
          onChange={(e) => onChangeRole(assignment.id, e.target.value as Role)}
          disabled={isChangingRole}
          fullWidth={false}
          className="text-xs py-1 px-2"
          aria-label={`Rol para ${storeLabel}`}
        >
          <option value="vendedora">vendedora</option>
          <option value="encargada">encargada</option>
        </Select>
        {isConfirmingRemove ? (
          <>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => onConfirmRemove(assignment.id)}
              disabled={isRemoving}
            >
              Confirmar (sin acceso)
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancelRemove}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemoveClick(assignment.id)}
            disabled={isRemoving}
            aria-label={`Quitar ${storeLabel}`}
          >
            Quitar
          </Button>
        )}
      </div>
    </li>
  );
}
