import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ChevronRight, ChevronLeft, Users } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  EmptyState,
  IconButton,
  Input,
  Skeleton,
} from '@/shared/ui';

export function UsersListPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const query = useUsers({ q: q || undefined, page, pageSize });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-text-primary">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al panel admin
          </Link>
          <h1 className="text-xl font-semibold">Gestionar usuarios</h1>
          <p className="text-sm text-text-muted">
            Crear, editar y desactivar usuarios del sistema.
          </p>
        </div>
        <Link to="/users/new">
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
            Nuevo
          </Button>
        </Link>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-subtle pointer-events-none" />
        <Input
          id="users-search"
          type="search"
          placeholder="Buscar por email o nombre..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="pl-9"
          aria-label="Buscar por email o nombre"
        />
      </div>

      {/* Loading */}
      {query.isLoading && (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-surface-border last:border-b-0"
              >
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {query.isError && <Alert variant="error">No pudimos cargar los usuarios.</Alert>}

      {/* List */}
      {query.data && (
        <>
          {query.data.items.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title="Sin resultados"
                  description="Probá con otra búsqueda o creá un usuario nuevo."
                  action={
                    <Link to="/users/new">
                      <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                        Nuevo usuario
                      </Button>
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul>
                  {query.data.items.map((u) => (
                    <li key={u.id} className="border-b border-surface-border last:border-b-0">
                      <Link
                        to={`/users/${u.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors duration-150"
                      >
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-surface-sunken text-text-secondary flex items-center justify-center text-sm font-medium shrink-0 uppercase">
                          {u.fullName.charAt(0)}
                        </div>

                        {/* Name + email */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {u.fullName}
                          </p>
                          <p className="text-xs text-text-muted truncate">{u.email}</p>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          {u.isAdmin && <Badge variant="info">Admin</Badge>}
                          {!u.isActive && <Badge variant="default">Inactivo</Badge>}
                          <Badge variant="default">
                            {u.assignmentsCount === 0
                              ? 'Sin tienda'
                              : u.assignmentsCount === 1
                                ? '1 tienda'
                                : `${u.assignmentsCount} tiendas`}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-text-subtle" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="justify-between">
                <span className="text-sm text-text-secondary">
                  Página {query.data.page} de{' '}
                  {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))} ·{' '}
                  {query.data.total} usuario{query.data.total === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={<ChevronLeft className="h-4 w-4" />}
                    label="Página anterior"
                    size="sm"
                    variant="secondary"
                    disabled={query.data.page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  />
                  <IconButton
                    icon={<ChevronRight className="h-4 w-4" />}
                    label="Página siguiente"
                    size="sm"
                    variant="secondary"
                    disabled={query.data.page >= Math.ceil(query.data.total / query.data.pageSize)}
                    onClick={() => setPage((p) => p + 1)}
                  />
                </div>
              </CardFooter>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
