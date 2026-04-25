import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useCreateStore } from '../hooks/useStoresAdmin';
import { StoreForm } from '../components/StoreForm';

export function StoreCreatePage() {
  const navigate = useNavigate();
  const create = useCreateStore({
    onSuccess: (store) => navigate(`/stores/${store.id}`, { replace: true }),
  });
  const errorMessage = useErrorMessage(create.error as HttpError | null | undefined);

  return (
    <div className="min-h-screen bg-surface-base">
      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4 text-slate-900">
        <header className="flex flex-col gap-1">
          <Link
            to="/stores"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
          <h1 className="text-xl font-semibold">Nueva tienda</h1>
          <p className="text-sm text-slate-500">
            Solo puede existir un único almacén central activo. Las sucursales son ilimitadas.
          </p>
        </header>
        <Card>
          <CardContent>
            <StoreForm
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
