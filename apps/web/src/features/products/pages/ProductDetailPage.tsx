import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Power, RotateCcw } from 'lucide-react';
import { useProduct } from '../hooks/useProducts';
import {
  useCreateVariant,
  useDeactivateProduct,
  useReactivateProduct,
  useUpdateProduct,
} from '../hooks/useProductsAdmin';
import { ProductForm } from '../components/ProductForm';
import { VariantForm } from '../components/VariantForm';
import { VariantList } from '../components/VariantList';
import type { HttpError } from '@/shared/services/httpClient';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
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

export function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id ?? '';
  const query = useProduct(productId);

  const update = useUpdateProduct(productId);
  const deactivate = useDeactivateProduct(productId);
  const reactivate = useReactivateProduct(productId);
  const createVariant = useCreateVariant(productId);

  const [showAddVariant, setShowAddVariant] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);

  const updateError = useErrorMessage(update.error as HttpError | null | undefined);
  const deactivateError = useErrorMessage(deactivate.error as HttpError | null | undefined);
  const reactivateError = useErrorMessage(reactivate.error as HttpError | null | undefined);
  const variantError = useErrorMessage(createVariant.error as HttpError | null | undefined);

  if (!productId) {
    return <main className="p-4">ID inválido.</main>;
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4 text-text-primary">
        <header className="flex flex-col gap-1">
          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>
          <h1 className="text-xl font-semibold">Detalle del producto</h1>
        </header>

        {query.isLoading && <p className="text-sm text-text-muted">Cargando...</p>}
        {query.isError && <Alert variant="error">No pudimos cargar el producto.</Alert>}

        {query.data && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Información</CardTitle>
                <div className="flex items-center gap-2">
                  {!query.data.isActive && <Badge variant="default">Inactivo</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <ProductForm
                  mode="edit"
                  initialValues={{
                    code: query.data.code,
                    name: query.data.name,
                    description: query.data.description ?? '',
                  }}
                  isPending={update.isPending}
                  errorMessage={updateError}
                  onSubmit={(payload) =>
                    update.mutate({ name: payload.name, description: payload.description })
                  }
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
                      Desactivar producto
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
                      Reactivar producto
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
                  title="Desactivar producto"
                  description="El producto dejará de aparecer en el inventario activo. Podés reactivarlo después."
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
                  title="Reactivar producto"
                  description="El producto volverá a estar disponible en el inventario."
                  confirmLabel="Reactivar"
                  variant="default"
                  isPending={reactivate.isPending}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Variantes ({query.data.variants.length})</CardTitle>
                {!showAddVariant && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setShowAddVariant(true)}
                  >
                    Agregar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <VariantList variants={query.data.variants} />
                {showAddVariant && (
                  <div className="rounded-lg border border-dashed border-surface-border-strong p-3">
                    <VariantForm
                      mode="create"
                      isPending={createVariant.isPending}
                      errorMessage={variantError}
                      onSubmit={(payload) => {
                        createVariant.mutate(payload, {
                          onSuccess: () => {
                            setShowAddVariant(false);
                          },
                        });
                      }}
                      onCancel={() => setShowAddVariant(false)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
