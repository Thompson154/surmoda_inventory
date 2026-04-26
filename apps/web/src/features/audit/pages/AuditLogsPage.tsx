import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ScrollText, Search } from 'lucide-react';
import { useAuditLogs } from '../hooks/useAudit';
import { Alert, Card, CardContent, CardFooter, IconButton, Select, Skeleton } from '@/shared/ui';
import { AppShell } from '@/shared/layout/AppShell';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useUsers } from '@/features/users/hooks/useUsers';
import { useStores } from '@/features/stores/hooks/useStores';

const PAGE_SIZE = 50;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function summarizePayload(payload: Record<string, unknown>): string {
  // Compact one-liner: pick the 2-3 most useful keys per common action.
  // Fallback: show first 3 entries truncated.
  const keys = Object.keys(payload);
  if (keys.length === 0) return '—';
  const preferred = ['storeId', 'toStoreId', 'fromStoreId', 'totalCents', 'quantity', 'status'];
  const entries: string[] = [];
  for (const k of preferred) {
    if (k in payload) {
      const v = payload[k];
      if (v !== null && v !== undefined) entries.push(`${k}: ${String(v)}`);
    }
    if (entries.length >= 3) break;
  }
  if (entries.length === 0) {
    for (const k of keys.slice(0, 3)) {
      const v = payload[k];
      if (typeof v === 'object') continue;
      entries.push(`${k}: ${String(v)}`);
    }
  }
  return entries.join(' · ') || '—';
}

export function AuditLogsPage() {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false);
  const backTo = isAdmin ? '/admin' : '/sedes';
  const backLabel = isAdmin ? 'Volver al panel admin' : 'Volver a sucursales';

  const [userId, setUserId] = useState<string>('');
  const [storeId, setStoreId] = useState<string>('');
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      userId: userId || undefined,
      storeId: storeId || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [userId, storeId, page],
  );

  const query = useAuditLogs(filters);
  const usersQuery = useUsers({ pageSize: 200 });
  const storesQuery = useStores({ pageSize: 100 });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Link
              to={backTo}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-slate-500" />
              Auditoría del sistema
            </h1>
            <p className="text-xs text-slate-500">
              Log inmutable de acciones de usuario — admin / encargada
            </p>
          </div>
        </header>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-3">
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label htmlFor="audit-user" className="text-xs text-slate-500">
                Usuario
              </label>
              <Select
                id="audit-user"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por usuario"
              >
                <option value="">Todos los usuarios</option>
                {usersQuery.data?.items.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[200px]">
              <label htmlFor="audit-store" className="text-xs text-slate-500">
                Sucursal
              </label>
              <Select
                id="audit-store"
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por sucursal"
              >
                <option value="">Todas las sucursales</option>
                {storesQuery.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </Select>
            </div>

            <p className="ml-auto text-xs text-slate-500 font-mono">
              {query.data ? `${query.data.total} registros` : '—'}
            </p>
          </CardContent>
        </Card>

        {query.isError && <Alert variant="error">No pudimos cargar el log.</Alert>}

        {query.isLoading && (
          <Card>
            <CardContent className="p-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="border-b border-surface-border last:border-b-0 px-3 py-2">
                  <Skeleton className="h-3 w-48 mb-2" />
                  <Skeleton className="h-3 w-72" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {query.data && (
          <Card>
            <CardContent className="p-0">
              {query.data.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-slate-500">
                  <Search className="h-6 w-6" />
                  <p className="text-sm">Sin eventos para los filtros seleccionados.</p>
                </div>
              ) : (
                <ul>
                  {query.data.items.map((row) => (
                    <li
                      key={row.id}
                      className="border-b border-surface-border last:border-b-0 px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          {formatTimestamp(row.timestamp)}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {row.action}
                        </span>
                        <span className="text-xs text-slate-500">
                          {row.entity}
                          {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
                        </span>
                        <span className="text-xs text-slate-500 ml-auto">
                          {row.userLabel ?? '— sistema —'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 truncate">
                        {summarizePayload(row.payload)}
                      </p>
                      {(row.ip || row.userAgent) && (
                        <p className="mt-0.5 text-[10px] text-slate-400 font-mono truncate">
                          {row.ip ?? ''}
                          {row.ip && row.userAgent ? ' · ' : ''}
                          {row.userAgent ?? ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>

            {query.data.total > PAGE_SIZE && (
              <CardFooter className="justify-between">
                <span className="text-xs text-slate-600">
                  Página {query.data.page} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={<ChevronLeft className="h-4 w-4" />}
                    label="Página anterior"
                    size="sm"
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  />
                  <IconButton
                    icon={<ChevronRight className="h-4 w-4" />}
                    label="Página siguiente"
                    size="sm"
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  />
                </div>
              </CardFooter>
            )}
          </Card>
        )}
      </main>
    </AppShell>
  );
}
