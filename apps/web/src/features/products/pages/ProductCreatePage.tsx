import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useCreateProduct } from '../hooks/useProductsAdmin';
import { ProductForm } from '../components/ProductForm';

export function ProductCreatePage() {
  const navigate = useNavigate();
  const create = useCreateProduct({
    onSuccess: (product) => navigate(`/products/${product.id}`, { replace: true }),
  });
  const errorMessage = useErrorMessage(create.error as HttpError | null | undefined);

  return (
    <div className="min-h-screen bg-surface-base">
      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4 text-slate-900">
        <header className="flex flex-col gap-1">
          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>
          <h1 className="text-xl font-semibold">Nuevo producto</h1>
          <p className="text-sm text-slate-500">
            Después de crear el producto vas a poder agregar variantes (talla + color + precio + imagen).
          </p>
        </header>
        <Card>
          <CardContent>
            <ProductForm
              mode="create"
              isPending={create.isPending}
              errorMessage={errorMessage}
              onSubmit={(payload) => create.mutate(payload)}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
