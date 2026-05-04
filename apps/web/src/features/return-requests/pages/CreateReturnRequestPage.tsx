import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateReturnRequest } from '../hooks/useReturnRequests';
import { ReturnRequestForm } from '../components/ReturnRequestForm';
import type { CreateReturnRequestPayload } from '../types';
import { Alert, ConfirmDialog } from '@/shared/ui';
import { useToast } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

export function CreateReturnRequestPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateReturnRequest();
  const spanishError = useErrorMessage(create.error as HttpError | null | undefined);
  // WHY: empleadas tienen exactly 1 assignment; admin podría tener 0 o N — fallback al primero
  const activeStoreId = useAuthStore((s) => s.user?.assignments?.[0]?.storeId ?? '');

  const [pendingPayload, setPendingPayload] = useState<CreateReturnRequestPayload | null>(null);

  // WHY: form calls onSubmit to stage payload; page shows ConfirmDialog before mutating
  function handleFormSubmit(payload: CreateReturnRequestPayload) {
    setPendingPayload(payload);
  }

  function handleConfirm() {
    if (!pendingPayload) return;
    create.mutate(pendingPayload, {
      onSuccess: () => {
        toast.success('Solicitud enviada');
        setPendingPayload(null);
        void navigate('/return-requests/mine');
      },
      onError: () => {
        setPendingPayload(null);
        toast.error(spanishError ?? 'No pudimos enviar la solicitud.');
      },
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 p-4 text-text-primary">
      <h1 className="text-xl font-semibold">Nueva solicitud</h1>
      <p className="text-sm text-text-secondary">
        Completá los datos para solicitar una devolución o cambio. El admin la revisará y aprobará.
      </p>

      {spanishError && <Alert variant="error">{spanishError}</Alert>}

      <ReturnRequestForm
        storeId={activeStoreId}
        onSubmit={handleFormSubmit}
        isPending={create.isPending}
      />

      <ConfirmDialog
        open={Boolean(pendingPayload)}
        onClose={() => setPendingPayload(null)}
        onConfirm={handleConfirm}
        title="Mandar solicitud al admin"
        description="Una vez enviada, esperá la decisión del admin."
        confirmLabel="Confirmar"
        variant="default"
        isPending={create.isPending}
      />
    </main>
  );
}
