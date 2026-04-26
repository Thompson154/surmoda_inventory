import { Image as ImageIcon } from 'lucide-react';
import { Alert, Modal, Skeleton } from '@/shared/ui';
import { useDelivery } from '../hooks/useDeliveries';
import { getImageUrl } from '@/features/products/services/productsService';
import { sizeLabel } from '@/shared/format/sizeLabel';

interface DeliveryDetailDrawerProps {
  deliveryId: string | null;
  onClose: () => void;
}

export function DeliveryDetailDrawer({ deliveryId, onClose }: DeliveryDetailDrawerProps) {
  const open = deliveryId !== null;
  const query = useDelivery(open ? deliveryId ?? undefined : undefined);

  return (
    <Modal isOpen={open} onClose={onClose} title="Detalle de entrega">
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
        {query.isLoading && (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        )}
        {query.isError && <Alert variant="error">No pudimos cargar la entrega.</Alert>}
        {query.data && (
          <>
            <div className="rounded-lg border border-surface-border p-3 text-sm">
              <p className="text-slate-700">
                <span className="font-medium">Tipo:</span>{' '}
                {query.data.kind === 'reception' ? 'Recepción al almacén' : 'Distribución'}
              </p>
              {query.data.fromStoreName && (
                <p className="text-slate-600">Origen: {query.data.fromStoreName}</p>
              )}
              <p className="text-slate-600">Destino: {query.data.toStoreName}</p>
              <p className="text-xs text-slate-500 mt-1">
                Por {query.data.createdByFullName} ·{' '}
                {new Date(query.data.createdAt).toLocaleString('es-BO', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
              {query.data.note && (
                <p className="text-xs text-slate-500 mt-1 italic">"{query.data.note}"</p>
              )}
            </div>

            <ul className="flex flex-col gap-2">
              {query.data.items.map((it) => {
                const url = getImageUrl(it.imagePath);
                const label = sizeLabel(it.size);
                return (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 rounded-lg border border-surface-border p-2"
                  >
                    <div className="h-12 w-12 shrink-0 rounded-md border border-surface-border bg-surface-sunken flex items-center justify-center overflow-hidden">
                      {url ? (
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {it.productName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">{it.productCode}</span> · {label} ·{' '}
                        <span className="capitalize">{it.color}</span>
                      </p>
                    </div>
                    <span className="text-base font-semibold text-slate-900 shrink-0">
                      {it.quantity}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
