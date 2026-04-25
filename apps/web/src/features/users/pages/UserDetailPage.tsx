import { useState, useEffect, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useDeactivateUser,
  useReactivateUser,
  useUpdateUser,
  useUser,
} from '../hooks/useUsers';
import { AssignmentsManager } from '../components/AssignmentsManager';
import type { HttpError } from '@/shared/services/httpClient';

export function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id ?? '';
  const query = useUser(userId);
  const update = useUpdateUser(userId);
  const deactivate = useDeactivateUser(userId);
  const reactivate = useReactivateUser(userId);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Sync local edit state with fetched data
  useEffect(() => {
    if (query.data) {
      setFullName(query.data.fullName);
      setIsAdmin(query.data.isAdmin);
    }
  }, [query.data]);

  if (!userId) {
    return <main className="p-4">ID inválido.</main>;
  }

  const handleSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update.mutate(
      { fullName: fullName.trim(), isAdmin },
      { onSuccess: () => setEditing(false) },
    );
  };

  const handleCancelEdit = () => {
    if (query.data) {
      setFullName(query.data.fullName);
      setIsAdmin(query.data.isAdmin);
    }
    setEditing(false);
  };

  const updateError = update.error
    ? mapUserError((update.error as HttpError).code)
    : null;
  const deactivateError = deactivate.error
    ? mapUserError((deactivate.error as HttpError).code)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 text-slate-900">
      <header className="flex flex-col gap-1">
        <Link to="/users" className="text-sm text-slate-500 hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="text-xl font-semibold">Detalle del usuario</h1>
      </header>

      {query.isLoading && <p className="text-sm text-slate-500">Cargando...</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-red-600">
          No pudimos cargar el usuario.
        </p>
      )}

      {query.data && (
        <article className="flex flex-col gap-6 rounded border border-slate-200 bg-white p-4">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Datos personales</h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </button>
              )}
            </div>

            {!editing ? (
              <>
                <Field label="Nombre completo">{query.data.fullName}</Field>
                <Field label="Email">{query.data.email}</Field>
                <Field label="Tipo de cuenta">
                  {query.data.isAdmin ? 'Admin global' : 'Staff de sucursal'}
                </Field>
                <Field label="Estado">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        query.data.isActive
                          ? 'rounded bg-green-100 px-2 py-0.5 text-xs text-green-800'
                          : 'rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700'
                      }
                    >
                      {query.data.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                    {query.data.isActive ? (
                      <button
                        type="button"
                        onClick={() => deactivate.mutate()}
                        disabled={deactivate.isPending}
                        className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deactivate.isPending ? 'Desactivando...' : 'Desactivar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => reactivate.mutate()}
                        disabled={reactivate.isPending}
                        className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        {reactivate.isPending ? 'Activando...' : 'Reactivar'}
                      </button>
                    )}
                  </div>
                </Field>
                {deactivateError && (
                  <p role="alert" className="text-sm text-red-600">
                    {deactivateError}
                  </p>
                )}
              </>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-700">Nombre completo</span>
                  <input
                    type="text"
                    required
                    minLength={1}
                    maxLength={120}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                  />
                  Admin global
                </label>
                {updateError && (
                  <p role="alert" className="text-sm text-red-600">
                    {updateError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={update.isPending}
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-400"
                  >
                    {update.isPending ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </section>

          <hr className="border-slate-200" />

          <AssignmentsManager userId={userId} isUserAdmin={query.data.isAdmin} />
        </article>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function mapUserError(code?: string): string {
  switch (code) {
    case 'USER_DEACTIVATE_LAST_ADMIN':
      return 'No se puede desactivar/demoter al último admin activo.';
    case 'USER_NOT_FOUND':
      return 'El usuario no existe.';
    case 'VALIDATION_ERROR':
      return 'Revisá los campos.';
    default:
      return 'No pudimos completar la operación.';
  }
}
