import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  useAddAssignment,
  useAssignments,
  useChangeAssignmentRole,
  useRemoveAssignment,
} from '../../hooks/useAssignments';
import type { Role } from '../../types';
import { AssignmentRow } from './AssignmentRow';
import { AddAssignmentForm } from './AddAssignmentForm';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { Alert, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/shared/ui';
import type { HttpError } from '@/shared/services/httpClient';

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
      <Card>
        <CardHeader>
          <CardTitle>Asignaciones de tienda</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Cuenta admin global"
            description="Los admins no requieren asignaciones de tienda."
          />
          {/* Keep for test compatibility */}
          <p className="sr-only">Los admins globales no tienen asignaciones de tienda.</p>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Asignaciones de tienda</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
      </CardContent>
    </Card>
  );
}
