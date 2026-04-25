import { useState } from 'react';
import {
  useAddAssignment,
  useAssignments,
  useChangeAssignmentRole,
  useRemoveAssignment,
} from '../../hooks/useAssignments';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { Alert } from '@/shared/ui';
import type { Role } from '../../types';
import type { HttpError } from '@/shared/services/httpClient';
import { AssignmentRow } from './AssignmentRow';
import { AddAssignmentForm } from './AddAssignmentForm';

interface AssignmentsManagerProps {
  userId: string;
  isUserAdmin: boolean;
}

export function AssignmentsManager({ userId, isUserAdmin }: AssignmentsManagerProps) {
  const list = useAssignments(userId);
  const add = useAddAssignment(userId);
  const changeRole = useChangeAssignmentRole(userId);
  const remove = useRemoveAssignment(userId);

  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const addError = useErrorMessage(add.error as HttpError | null | undefined);
  const removeError = useErrorMessage(remove.error as HttpError | null | undefined);
  const changeRoleError = useErrorMessage(changeRole.error as HttpError | null | undefined);

  if (isUserAdmin) {
    return (
      <p className="text-sm text-slate-500">
        Los admins globales no tienen asignaciones de tienda.
      </p>
    );
  }

  const handleChangeRole = (assignmentId: string, newRole: Role) => {
    changeRole.mutate({ assignmentId, payload: { role: newRole } });
  };

  const handleRemoveClick = (assignmentId: string) => {
    const items = list.data?.items ?? [];
    const isLast = items.length <= 1;
    if (isLast) {
      setConfirmingRemoveId(assignmentId);
      return;
    }
    remove.mutate({ assignmentId });
  };

  const handleConfirmRemove = (assignmentId: string) => {
    remove.mutate(
      { assignmentId, confirm: true },
      { onSuccess: () => setConfirmingRemoveId(null) },
    );
  };

  const handleAdd = (storeId: string, role: Role) => {
    add.mutate({ storeId, role });
  };

  const items = list.data?.items ?? [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-slate-800">Asignaciones de tienda</h2>

      {list.isLoading && <p className="text-sm text-slate-500">Cargando asignaciones...</p>}
      {list.isError && <Alert variant="error">No pudimos cargar las asignaciones.</Alert>}

      {items.length === 0 && !list.isLoading && (
        <p className="text-sm text-slate-500">Sin asignaciones aún.</p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((a) => (
          <AssignmentRow
            key={a.id}
            assignment={a}
            isConfirmingRemove={confirmingRemoveId === a.id}
            isChangingRole={changeRole.isPending}
            isRemoving={remove.isPending}
            onChangeRole={handleChangeRole}
            onRemoveClick={handleRemoveClick}
            onConfirmRemove={handleConfirmRemove}
            onCancelRemove={() => setConfirmingRemoveId(null)}
          />
        ))}
      </ul>

      <AddAssignmentForm isPending={add.isPending} onAdd={handleAdd} />

      {addError && <Alert variant="error">{addError}</Alert>}
      {removeError && <Alert variant="error">{removeError}</Alert>}
      {changeRoleError && <Alert variant="error">{changeRoleError}</Alert>}
    </section>
  );
}
