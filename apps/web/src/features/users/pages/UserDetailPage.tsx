import { Link, useParams } from 'react-router-dom';
import { useUser } from '../hooks/useUsers';

const STORE_LABELS: Record<string, string> = {
  'store-prado-seed': 'Prado',
  'store-zsur-seed': 'Z. Sur',
  'store-almacen-seed': 'Almacén',
};

export function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const query = useUser(params.id);

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
        <article className="flex flex-col gap-4 rounded border border-slate-200 bg-white p-4">
          <Field label="Nombre completo">{query.data.fullName}</Field>
          <Field label="Email">{query.data.email}</Field>
          <Field label="Estado">{query.data.isActive ? 'Activo' : 'Inactivo'}</Field>
          <Field label="Tipo de cuenta">
            {query.data.isAdmin ? 'Admin global' : 'Staff de sucursal'}
          </Field>

          {!query.data.isAdmin && (
            <Field label="Asignaciones">
              {query.data.assignments.length === 0 ? (
                <span className="text-sm text-slate-500">Sin asignaciones</span>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {query.data.assignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded bg-slate-50 px-3 py-2"
                    >
                      <span>{STORE_LABELS[a.storeId] ?? a.storeId}</span>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">{a.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          )}

          <p className="text-xs text-slate-500">
            Editar nombre, cambiar rol, desactivar y reset de contraseña: features 005-007.
          </p>
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
