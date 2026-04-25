import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';

export function UsersListPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const query = useUsers({ q: q || undefined, page, pageSize });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <Link
          to="/users/new"
          className="self-start rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          + Nuevo usuario
        </Link>
      </header>

      <input
        type="search"
        placeholder="Buscar por email o nombre..."
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
      />

      {query.isLoading && <p className="text-sm text-slate-500">Cargando...</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-red-600">
          No pudimos cargar los usuarios.
        </p>
      )}

      {query.data && (
        <>
          <ul className="flex flex-col divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {query.data.items.length === 0 && (
              <li className="p-3 text-sm text-slate-500">Sin resultados.</li>
            )}
            {query.data.items.map((u) => (
              <li key={u.id} className="flex items-center justify-between p-3">
                <div className="flex flex-col">
                  <Link
                    to={`/users/${u.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {u.fullName}
                  </Link>
                  <span className="text-xs text-slate-500">{u.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {u.isAdmin && (
                    <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">admin</span>
                  )}
                  {!u.isActive && (
                    <span className="rounded bg-slate-200 px-2 py-1 text-slate-700">inactivo</span>
                  )}
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">
                    {u.assignmentsCount} {u.assignmentsCount === 1 ? 'tienda' : 'tiendas'}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onChange={setPage}
          />
        </>
      )}
    </main>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Página {page} de {totalPages} — {total} usuario{total === 1 ? '' : 's'}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
