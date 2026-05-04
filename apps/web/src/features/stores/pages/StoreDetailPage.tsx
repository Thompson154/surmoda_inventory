import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Power, RotateCcw } from 'lucide-react';
import { useStore } from '../hooks/useStores';
import { useDeactivateStore, useReactivateStore, useUpdateStore } from '../hooks/useStoresAdmin';
import { StoreForm } from '../components/StoreForm';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
} from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';

export function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const storeId = params.id ?? '';
  const query = useStore(storeId);
  const update = useUpdateStore(storeId);
  const deactivate = useDeactivateStore(storeId);
  const reactivate = useReactivateStore(storeId);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);

  const updateError = useErrorMessage(update.error as HttpError | null | undefined);
  const deactivateError = useErrorMessage(deactivate.error as HttpError | null | undefined);
  const reactivateError = useErrorMessage(reactivate.error as HttpError | null | undefined);

  if (!storeId) {
    return <main className="p-4">ID inválido.</main>;
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4 text-text-primary">
        <header className="flex flex-col gap-1">
          <Link
            to="/stores"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
          <h1 className="text-xl font-semibold">Detalle de la tienda</h1>
        </header>

        {query.isLoading && <p className="text-sm text-text-muted">Cargando...</p>}
        {query.isError && <Alert variant="error">No pudimos cargar la tienda.</Alert>}

        {query.data && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Información</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={query.data.kind === 'warehouse' ? 'info' : 'default'}>
                    {query.data.kind === 'warehouse' ? 'Almacén' : 'Sucursal'}
                  </Badge>
                  {!query.data.isActive && <Badge variant="default">Inactiva</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <StoreForm
                  mode="edit"
                  initialValues={{
                    code: query.data.code,
                    name: query.data.name,
                    kind: query.data.kind,
                  }}
                  isPending={update.isPending}
                  errorMessage={updateError}
                  onSubmit={({ code, name }) => update.mutate({ code, name })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estado</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {query.data.isActive ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      leftIcon={<Power className="h-3.5 w-3.5" />}
                      onClick={() => setConfirmDeactivate(true)}
                      disabled={deactivate.isPending}
                      isLoading={deactivate.isPending}
                    >
                      {deactivate.isPending ? 'Desactivando...' : 'Desactivar'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                      onClick={() => setConfirmReactivate(true)}
                      disabled={reactivate.isPending}
                      isLoading={reactivate.isPending}
                    >
                      {reactivate.isPending ? 'Activando...' : 'Reactivar'}
                    </Button>
                  )}
                </div>
                {deactivateError && <Alert variant="error">{deactivateError}</Alert>}
                {reactivateError && <Alert variant="error">{reactivateError}</Alert>}

                <ConfirmDialog
                  open={confirmDeactivate}
                  onClose={() => setConfirmDeactivate(false)}
                  onConfirm={() => {
                    deactivate.mutate();
                    setConfirmDeactivate(false);
                  }}
                  title="Desactivar tienda"
                  description="La tienda quedará inactiva. Podés reactivarla más tarde."
                  confirmLabel="Desactivar"
                  variant="danger"
                  requiresReason
                  isPending={deactivate.isPending}
                />

                <ConfirmDialog
                  open={confirmReactivate}
                  onClose={() => setConfirmReactivate(false)}
                  onConfirm={() => {
                    reactivate.mutate();
                    setConfirmReactivate(false);
                  }}
                  title="Reactivar tienda"
                  description="La tienda volverá a estar disponible."
                  confirmLabel="Reactivar"
                  variant="default"
                  isPending={reactivate.isPending}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
