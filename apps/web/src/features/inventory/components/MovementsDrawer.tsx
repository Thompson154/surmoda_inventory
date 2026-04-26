import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, Badge, Card, CardContent, IconButton, Modal, Skeleton } from '@/shared/ui';
import { useStockMovements } from '../hooks/useInventory';

interface MovementsDrawerProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 20;

export function MovementsDrawer({ storeId, open, onClose }: MovementsDrawerProps) {
  const [page, setPage] = useState(1);
  const query = useStockMovements(open ? storeId : undefined, page, PAGE_SIZE);

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  return (
    <Modal isOpen={open} onClose={onClose} title="Movimientos">
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
        <p className="text-xs text-slate-500">Últimas modificaciones de inventario.</p>

        {query.isLoading && (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        )}

        {query.isError && <Alert variant="error">No pudimos cargar los movimientos.</Alert>}

        {query.data && query.data.items.length === 0 && (
          <p className="text-sm text-slate-500">Aún no hay movimientos en esta sede.</p>
        )}

        {query.data?.items.map((m) => {
          const isAdjustment = m.type === 'adjusted';
          const delta = m.payload.delta ?? 0;
          return (
            <Card key={m.id}>
              <CardContent className="py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={isAdjustment ? 'info' : 'default'}>
                      {isAdjustment ? 'Stock' : 'Permiso'}
                    </Badge>
                    {isAdjustment && (
                      <span className={`text-sm font-mono ${delta >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                        {delta >= 0 ? '+' : ''}
                        {delta}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(m.createdAt).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                {isAdjustment ? (
                  <>
                    <p className="text-sm text-slate-700 break-words">
                      <span className="font-mono">{m.productCode ?? '—'}</span>
                      {m.barcode && (
                        <>
                          {' · '}
                          <span className="font-mono text-slate-400 break-all">{m.barcode}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 break-words">
                      <span className="font-mono">
                        {m.payload.previous ?? 0} → {m.payload.next ?? 0}
                      </span>
                      <span> · por </span>
                      <span className="font-medium text-slate-600">{m.userFullName}</span>
                    </p>
                    {m.payload.reason && (
                      <p className="text-xs text-slate-500 italic break-words whitespace-pre-wrap">
                        “{m.payload.reason}”
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-700 break-words">
                    Edición vendedora {m.payload.isEnabled ? 'habilitada' : 'deshabilitada'} por{' '}
                    <span className="font-medium">{m.userFullName}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {query.data && query.data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Página {query.data.page} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                icon={<ChevronLeft className="h-4 w-4" />}
                label="Anterior"
                size="sm"
                variant="secondary"
                disabled={query.data.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              />
              <IconButton
                icon={<ChevronRight className="h-4 w-4" />}
                label="Siguiente"
                size="sm"
                variant="secondary"
                disabled={query.data.page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
