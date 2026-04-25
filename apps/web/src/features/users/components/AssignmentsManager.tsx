import { useState, type FormEvent } from 'react';
import {
  useAddAssignment,
  useAssignments,
  useChangeAssignmentRole,
  useRemoveAssignment,
} from '../hooks/useAssignments';
import { useStores, getStoreLabel } from '../hooks/useStores';
import type { Role } from '../types';
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
  const stores = useStores();

  const [storeId, setStoreId] = useState(stores.data[0]?.id ?? '');
  const [role, setRole] = useState<Role>('vendedora');
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  if (isUserAdmin) {
    return (
      <p className="text-sm text-slate-500">
        Los admins globales no tienen asignaciones de tienda.
      </p>
    );
  }

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!storeId) return;
    add.mutate({ storeId, role });
  };

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

  const items = list.data?.items ?? [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-slate-800">Asignaciones de tienda</h2>

      {list.isLoading && <p className="text-sm text-slate-500">Cargando asignaciones...</p>}
      {list.isError && (
        <p role="alert" className="text-sm text-red-600">
          No pudimos cargar las asignaciones.
        </p>
      )}

      {items.length === 0 && !list.isLoading && (
        <p className="text-sm text-slate-500">Sin asignaciones aún.</p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{getStoreLabel(a.storeId)}</span>
              <span className="text-xs text-slate-500">{a.storeId}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={a.role}
                onChange={(e) => handleChangeRole(a.id, e.target.value as Role)}
                disabled={changeRole.isPending}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                aria-label={`Rol para ${getStoreLabel(a.storeId)}`}
              >
                <option value="vendedora">vendedora</option>
                <option value="encargada">encargada</option>
              </select>
              {confirmingRemoveId === a.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleConfirmRemove(a.id)}
                    disabled={remove.isPending}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Confirmar (sin acceso)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemoveId(null)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRemoveClick(a.id)}
                  disabled={remove.isPending}
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Quitar ${getStoreLabel(a.storeId)}`}
                >
                  Quitar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex items-end gap-2 rounded border border-dashed border-slate-300 p-3">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-slate-600">Tienda</span>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {stores.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-600">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="vendedora">vendedora</option>
            <option value="encargada">encargada</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={add.isPending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-400"
        >
          {add.isPending ? 'Agregando...' : '+ Agregar'}
        </button>
      </form>

      {add.error && (
        <p role="alert" className="text-sm text-red-600">
          {mapAssignmentError((add.error as HttpError).code)}
        </p>
      )}
      {remove.error && (
        <p role="alert" className="text-sm text-red-600">
          {mapAssignmentError((remove.error as HttpError).code)}
        </p>
      )}
      {changeRole.error && (
        <p role="alert" className="text-sm text-red-600">
          {mapAssignmentError((changeRole.error as HttpError).code)}
        </p>
      )}
    </section>
  );
}

function mapAssignmentError(code?: string): string {
  switch (code) {
    case 'ASSIGNMENT_DUPLICATE':
      return 'Ya tiene una asignación activa en esa tienda.';
    case 'ASSIGNMENT_NOT_FOUND':
      return 'La asignación no existe o ya fue removida.';
    case 'ASSIGNMENT_LAST_REMOVAL_REQUIRES_CONFIRM':
      return 'Esta es la última asignación. Confirmá si querés que el usuario quede sin acceso a tiendas.';
    case 'ASSIGNMENT_INVALID_FOR_ADMIN':
      return 'Los admins globales no pueden tener asignaciones.';
    default:
      return 'No pudimos completar la operación.';
  }
}
