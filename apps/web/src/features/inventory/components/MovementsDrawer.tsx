import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StockMovement, StockMovementType } from '@surmoda/contracts';
import { useStockMovements } from '../hooks/useInventory';
import { Alert, Badge, Card, CardContent, IconButton, Modal, Skeleton } from '@/shared/ui';

interface MovementsDrawerProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 20;

// Mapping de tipo de movimiento → presentación. Antes este componente solo
// distinguía `adjusted` vs todo-lo-demás (que se renderizaba como "Permiso"
// con texto "Edición vendedora habilitada/deshabilitada"). Cuando aparecieron
// los tipos de delivery + venta (T2/T3), todos esos movimientos caían a la
// rama incorrecta y se veían iguales entre sí, lo que daba la sensación de
// "skeletons stuck" cuando el usuario abría el drawer en una sucursal con
// muchas ventas/recepciones recientes.
const TYPE_META: Record<
  StockMovementType,
  { label: string; badge: 'info' | 'success' | 'warning' | 'default' }
> = {
  adjusted: { label: 'Stock', badge: 'info' },
  edit_permission_toggled: { label: 'Permiso', badge: 'default' },
  delivery_in: { label: 'Recepción', badge: 'success' },
  delivery_out: { label: 'Envío', badge: 'warning' },
  delivery_received_adjusted: { label: 'Ajuste recepción', badge: 'warning' },
  sale_out: { label: 'Venta', badge: 'default' },
};

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-status-success';
  if (delta < 0) return 'text-status-danger';
  return 'text-slate-500';
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

interface MovementCardProps {
  m: StockMovement;
}

function MovementCard({ m }: MovementCardProps) {
  const meta = TYPE_META[m.type];
  const delta = m.payload.delta ?? 0;
  const showDelta = m.type !== 'edit_permission_toggled';
  const showVariant = m.type !== 'edit_permission_toggled';
  const showStockTransition = m.type === 'adjusted' || m.type === 'delivery_received_adjusted';
  const isPermission = m.type === 'edit_permission_toggled';

  return (
    <Card>
      <CardContent className="py-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={meta.badge}>{meta.label}</Badge>
            {showDelta && (
              <span className={`text-sm font-mono ${deltaClass(delta)}`}>{formatDelta(delta)}</span>
            )}
          </div>
          <span className="text-xs text-slate-500">
            {new Date(m.createdAt).toLocaleString('es-BO', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        </div>

        {showVariant && (
          <p className="text-sm text-slate-700 break-words">
            <span className="font-mono">{m.productCode ?? '—'}</span>
            {m.barcode && (
              <>
                {' · '}
                <span className="font-mono text-slate-400 break-all">{m.barcode}</span>
              </>
            )}
          </p>
        )}

        {showStockTransition && (
          <p className="text-xs text-slate-500 break-words">
            <span className="font-mono">
              {m.payload.previous ?? 0} → {m.payload.next ?? 0}
            </span>
            <span> · por </span>
            <span className="font-medium text-slate-600">{m.userFullName}</span>
          </p>
        )}

        {!showStockTransition && !isPermission && (
          // Para sale_out / delivery_in / delivery_out el movimiento ya no
          // expone previous/next (se calculan al vuelo), pero igual queremos
          // mostrar quién lo originó para auditoría visual.
          <p className="text-xs text-slate-500">
            Por <span className="font-medium text-slate-600">{m.userFullName}</span>
          </p>
        )}

        {isPermission && (
          <p className="text-sm text-slate-700 break-words">
            Edición vendedora {m.payload.isEnabled ? 'habilitada' : 'deshabilitada'} por{' '}
            <span className="font-medium">{m.userFullName}</span>
          </p>
        )}

        {m.payload.reason && (
          <p className="text-xs text-slate-500 italic break-words whitespace-pre-wrap">
            “{m.payload.reason}”
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MovementsDrawer({ storeId, open, onClose }: MovementsDrawerProps) {
  const [page, setPage] = useState(1);
  const query = useStockMovements(open ? storeId : undefined, page, PAGE_SIZE);

  // Reset a página 1 cada vez que el drawer abre. Antes, como Modal mantiene
  // el componente montado y solo togglea visibilidad, el page state se
  // arrastraba entre aperturas: si el usuario quedó en page=2 y cerró, al
  // reabrir veía page=2 sin contexto, y al volver con "anterior" la query
  // tenía staleTime:0 → fetch fresco → loading state. Reset al abrir
  // garantiza un punto de entrada consistente.
  useEffect(() => {
    if (open) setPage(1);
  }, [open]);

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  return (
    <Modal isOpen={open} onClose={onClose} title="Movimientos">
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
        <p className="text-xs text-slate-500">Últimas modificaciones de inventario.</p>

        {/* Loading-only-when-no-data. Con placeholderData el cambio de página
            mantiene la lista anterior visible y NO dispara este bloque. */}
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

        {query.data?.items.map((m) => (
          <MovementCard key={m.id} m={m} />
        ))}

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
