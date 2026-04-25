import { Store, Trash2 } from 'lucide-react';
import { Badge, Button, IconButton, Select } from '@/shared/ui';
import { useStoreLabel } from '@/features/stores/hooks/useStores';
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
  const storeLabel = useStoreLabel(assignment.storeId);

  return (
    <li className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
      {/* Store info */}
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="text-sm font-medium text-slate-800">{storeLabel}</span>
        <Badge variant={assignment.role === 'encargada' ? 'success' : 'info'}>
          {assignment.role}
        </Badge>
      </div>

      {/* Actions */}
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
          <IconButton
            icon={<Trash2 className="h-4 w-4" />}
            label={`Quitar ${storeLabel}`}
            variant="ghost"
            size="sm"
            onClick={() => onRemoveClick(assignment.id)}
            disabled={isRemoving}
          />
        )}
      </div>
    </li>
  );
}
