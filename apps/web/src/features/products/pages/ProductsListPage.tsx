import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  ChevronRight,
  ChevronLeft,
  Package,
  ArrowLeft,
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
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

const PAGE_SIZE = 20;

export function ProductsListPage() {
  const [q, setQ] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);

  const query = useProducts({
    q: q || undefined,
    includeInactive: includeInactive || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  return (
    <div className="min-h-screen bg-surface-base">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
            <h1 className="text-xl font-semibold">Catálogo</h1>
          </div>
          <Link to="/products/new">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              Nuevo producto
            </Button>
          </Link>
        </header>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="products-search"
              type="search"
              placeholder="Buscar por código o nombre..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="pl-9"
              aria-label="Buscar por código o nombre"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(1);
              }}
            />
            Mostrar inactivos
          </label>
        </div>

        {query.isLoading && (
          <Card>
            <CardContent className="p-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 border-b border-surface-border last:border-b-0"
                >
                  <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {query.isError && <Alert variant="error">No pudimos cargar el catálogo.</Alert>}

        {query.data && (
          <>
            {query.data.items.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={<Package className="h-6 w-6" />}
                    title="Sin resultados"
                    description="Probá con otra búsqueda o creá un producto nuevo."
                    action={
                      <Link to="/products/new">
                        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                          Nuevo producto
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
                    {query.data.items.map((p) => (
                      <li
                        key={p.id}
                        className="border-b border-surface-border last:border-b-0"
                      >
                        <Link
                          to={`/products/${p.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors duration-150"
                        >
                          <div className="h-10 w-10 rounded-md bg-surface-sunken text-slate-600 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                            <p className="text-xs text-slate-500 truncate font-mono">{p.code}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="default">
                              {p.variantsCount === 0
                                ? 'Sin variantes'
                                : p.variantsCount === 1
                                ? '1 variante'
                                : `${p.variantsCount} variantes`}
                            </Badge>
                            {!p.isActive && <Badge variant="default">Inactivo</Badge>}
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="justify-between">
                  <span className="text-sm text-slate-600">
                    Página {query.data.page} de {totalPages} · {query.data.total} producto
                    {query.data.total === 1 ? '' : 's'}
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
                      disabled={query.data.page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    />
                  </div>
                </CardFooter>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
