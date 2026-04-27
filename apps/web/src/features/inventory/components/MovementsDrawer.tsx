import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Pencil,
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
    iconColor: 'text-slate-600',
  },
  delivery_in: {
    label: 'Recepción',
    icon: ArrowDownToLine,
    iconBg: 'bg-status-success-soft',
    iconColor: 'text-emerald-700',
  },
  delivery_out: {
    label: 'Envío',
    icon: ArrowUpFromLine,
    iconBg: 'bg-status-warning-soft',
    iconColor: 'text-amber-700',
  },
  delivery_received_adjusted: {
    label: 'Ajuste de recepción',
    icon: TriangleAlert,
    iconBg: 'bg-status-warning-soft',
    iconColor: 'text-amber-700',
  },
  sale_out: {
    label: 'Venta',
    icon: ShoppingBag,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-700',
  },
};

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function deltaColor(delta: number): string {
  if (delta > 0) return 'text-status-success';
  if (delta < 0) return 'text-status-danger';
  return 'text-slate-500';
}

interface MovementCardProps {
  m: StockMovement;
}

function MovementCard({ m }: MovementCardProps) {
  const meta = TYPE_META[m.type];
  const Icon = meta.icon;
  const delta = m.payload.delta ?? 0;
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
              <span className="text-sm font-semibold text-slate-900 truncate">{meta.label}</span>
              {showDelta && (
                <span className={`text-sm font-mono font-bold ${deltaColor(delta)}`}>
                  {formatDelta(delta)}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 shrink-0">
              {new Date(m.createdAt).toLocaleString('es-BO', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
          </div>

          {/* Línea 2: nombre del producto (cuando hay variante). */}
          {!isPermission && (
            <p className="text-sm text-slate-700 truncate">{m.productName ?? '—'}</p>
          )}

          {/* Línea 2 (alternativa): texto de permiso. */}
          {isPermission && (
            <p className="text-sm text-slate-700 break-words">
              Edición vendedora{' '}
              <span className="font-semibold">
                {m.payload.isEnabled ? 'habilitada' : 'deshabilitada'}
              </span>
            </p>
          )}

          {/* Línea 3: identificación de la variante + usuario. */}
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
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
              Por <span className="font-medium text-slate-700">{m.userFullName}</span>
            </span>
          </div>

          {/* Línea 4 (opcional): transición previous → next para ajustes. */}
          {(m.type === 'adjusted' || m.type === 'delivery_received_adjusted') && (
            <p className="text-xs text-slate-500">
              <span className="font-mono">
                {m.payload.previous ?? 0} → {m.payload.next ?? 0}
              </span>
            </p>
          )}

          {/* Línea 5 (opcional): motivo cuando aplica. */}
          {m.payload.reason && (
            <p className="text-xs text-slate-500 italic break-words whitespace-pre-wrap">
              “{m.payload.reason}”
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
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
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
