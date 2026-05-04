import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { StockMovement, StockMovementType } from '@surmoda/contracts';
import { useStockMovements } from '../hooks/useInventory';
import { Alert, Card, IconButton, Modal, Skeleton } from '@/shared/ui';
import { sizeLabel } from '@/shared/format/sizeLabel';

interface MovementsDrawerProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 20;

// Mapping de tipo → presentación visual completa. Cada tipo tiene un Lucide
// icon + paleta (bg + text) + label en español + descripción de la acción
// principal. La paleta usa los tokens de design system (status-success-soft,
// etc.) que ya están definidos en styles/index.css.
//
// Antes este componente solo distinguía 'adjusted' vs todo-lo-demás (que caía
// a un texto genérico de "permiso"). Cuando aparecieron los tipos T2/T3 de
// delivery + venta, todos esos movimientos caían a la rama incorrecta y se
// veían iguales entre sí, lo que daba la sensación de "skeletons stuck" en
// sucursales con muchas ventas/recepciones recientes.
interface TypeMeta {
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const TYPE_META: Record<StockMovementType, TypeMeta> = {
  adjusted: {
    label: 'Ajuste de stock',
    icon: Pencil,
    iconBg: 'bg-status-info-soft',
    iconColor: 'text-sky-700',
  },
  edit_permission_toggled: {
    label: 'Permiso de edición',
    icon: ShieldCheck,
    iconBg: 'bg-surface-sunken',
    iconColor: 'text-text-secondary',
  },
  delivery_in: {
    label: 'Recepción',
    icon: ArrowDownToLine,
    iconBg: 'bg-status-success-soft',
    iconColor: 'text-status-success',
  },
  delivery_out: {
    label: 'Envío',
    icon: ArrowUpFromLine,
    iconBg: 'bg-status-warning-soft',
    iconColor: 'text-status-warning',
  },
  delivery_received_adjusted: {
    label: 'Ajuste de recepción',
    icon: TriangleAlert,
    iconBg: 'bg-status-warning-soft',
    iconColor: 'text-status-warning',
  },
  sale_out: {
    label: 'Venta',
    icon: ShoppingBag,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-700',
  },
  sale_return: {
    label: 'Devolución',
    icon: RotateCcw,
    iconBg: 'bg-status-warning-soft',
    iconColor: 'text-status-warning',
  },
};

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function deltaColor(delta: number): string {
  if (delta > 0) return 'text-status-success';
  if (delta < 0) return 'text-status-danger';
  return 'text-text-muted';
}

interface MovementCardProps {
  m: StockMovement;
}

function MovementCard({ m }: MovementCardProps) {
  // Defensive: backwards-compat with movements stored before the
  // productName/variantSize/variantColor fields existed on the contract.
  // If the BE response shape ever drifts (e.g. cached SW serving an older
  // version, or the column is null in DB), we still render visible content
  // instead of a row that looks empty next to the colored icon.
  const meta = TYPE_META[m.type] ?? TYPE_META.adjusted;
  const Icon = meta.icon;
  // delivery_in / delivery_out / sale_out store `quantity` (not `delta`) in payload.
  // For outgoing movements the sign is negative; for incoming, positive.
  const isOutgoing = m.type === 'delivery_out' || m.type === 'sale_out';
  // Guard against `payload` arriving as null or as a JSON-encoded string
  // (Prisma returns Json columns as parsed objects, but defense-in-depth
  // costs nothing and prevents the whole row from going blank if a
  // pathological row exists in DB).
  const safePayload =
    m.payload && typeof m.payload === 'object' && !Array.isArray(m.payload) ? m.payload : {};
  const rawQty = safePayload.quantity ?? 0;
  const delta = safePayload.delta ?? (isOutgoing ? -rawQty : rawQty);
  const isPermission = m.type === 'edit_permission_toggled';
  const showDelta = !isPermission;

  const variantLabel = m.variantSize
    ? `${sizeLabel(m.variantSize)}${m.variantColor ? ` · ${m.variantColor}` : ''}`
    : null;

  return (
    <Card>
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon — color-coded por tipo. shrink-0 para que no se comprima cuando
            el nombre del producto es largo. */}
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.iconColor}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* Línea 1: tipo + delta a la izquierda, fecha a la derecha. */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-text-primary truncate">{meta.label}</span>
              {showDelta && (
                <span className={`text-sm font-mono font-bold ${deltaColor(delta)}`}>
                  {formatDelta(delta)}
                </span>
              )}
            </div>
            <span className="text-xs text-text-subtle shrink-0">
              {new Date(m.createdAt).toLocaleString('es-BO', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
          </div>

          {/* Línea 2: nombre del producto (cuando hay variante). */}
          {!isPermission && (
            <p className="text-sm text-text-secondary truncate">{m.productName ?? '—'}</p>
          )}

          {/* Línea 2 (alternativa): texto de permiso. */}
          {isPermission && (
            <p className="text-sm text-text-secondary break-words">
              Edición vendedora{' '}
              <span className="font-semibold">
                {safePayload.isEnabled ? 'habilitada' : 'deshabilitada'}
              </span>
            </p>
          )}

          {/* Línea 3: identificación de la variante + usuario. */}
          <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
            {!isPermission && (
              <span className="truncate font-mono">
                {m.productCode ?? '—'}
                {variantLabel && (
                  <>
                    {' '}
                    · <span className="font-sans">{variantLabel}</span>
                  </>
                )}
              </span>
            )}
            <span className="shrink-0">
              Por <span className="font-medium text-text-secondary">{m.userFullName}</span>
            </span>
          </div>

          {/* Línea 4 (opcional): transición previous → next para ajustes. */}
          {(m.type === 'adjusted' || m.type === 'delivery_received_adjusted') && (
            <p className="text-xs text-text-muted">
              <span className="font-mono">
                {safePayload.previous ?? 0} → {safePayload.next ?? 0}
              </span>
            </p>
          )}

          {/* Línea 5 (opcional): motivo cuando aplica. */}
          {safePayload.reason && (
            <p className="text-xs text-text-muted italic break-words whitespace-pre-wrap">
              “{safePayload.reason}”
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function MovementsDrawer({ storeId, open, onClose }: MovementsDrawerProps) {
  const [page, setPage] = useState(1);
  const query = useStockMovements(open ? storeId : undefined, page, PAGE_SIZE);

  // Reset a página 1 cada vez que el drawer abre. Antes, como Modal mantiene
  // el componente padre montado, el page state se arrastraba entre aperturas.
  useEffect(() => {
    if (open) setPage(1);
  }, [open]);

  // DEV diagnostic: cuando hay datos resueltos, loguear el shape del primer
  // item para diferenciar (a) un bug visual en el render vs (b) un response
  // del BE con campos faltantes/null. Strip-eable en build de prod.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!open || !query.data || query.data.items.length === 0) return;
    const first = query.data.items[0]!;
    // eslint-disable-next-line no-console
    console.debug('[MovementsDrawer] first item shape →', {
      id: first.id,
      type: first.type,
      productName: first.productName,
      productCode: first.productCode,
      variantSize: first.variantSize,
      variantColor: first.variantColor,
      userFullName: first.userFullName,
      payloadType: typeof first.payload,
      payloadKeys:
        first.payload && typeof first.payload === 'object' ? Object.keys(first.payload) : null,
      payload: first.payload,
    });
  }, [open, query.data]);

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  return (
    <Modal isOpen={open} onClose={onClose} title="Movimientos">
      {/* WHY: usar space-y en bloque normal en lugar de flex-col evita que */}
      {/* flex-shrink:1 (default) comprima los cards cuando 20 items exceden */}
      {/* max-h-[70vh]; ahora overflow-y-auto puede scrollear correctamente. */}
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        <p className="text-xs text-text-muted">Últimas modificaciones de inventario.</p>

        {/* Loading-only-when-no-data. Con placeholderData el cambio de página
            mantiene la lista anterior visible y NO dispara este bloque. */}
        {query.isLoading && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}

        {query.isError && <Alert variant="error">No pudimos cargar los movimientos.</Alert>}

        {query.data && query.data.items.length === 0 && (
          <p className="text-sm text-text-muted">Aún no hay movimientos en esta sede.</p>
        )}

        {query.data?.items.map((m) => (
          <MovementCard key={m.id} m={m} />
        ))}

        {query.data && query.data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-text-muted">
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
