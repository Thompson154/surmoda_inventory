import { useState } from 'react';
import { Power, RotateCcw } from 'lucide-react';
import { useDeactivateUser, useReactivateUser } from '../../hooks/useUsers';
import type { User } from '../../types';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
} from '@/shared/ui';
import type { HttpError } from '@/shared/services/httpClient';

interface UserStatusActionsProps {
  user: User;
}

export function UserStatusActions({ user }: UserStatusActionsProps) {
  const deactivate = useDeactivateUser(user.id);
  const reactivate = useReactivateUser(user.id);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);

  const deactivateError = useErrorMessage(deactivate.error as HttpError | null | undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de cuenta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {user.isActive ? (
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

        <ConfirmDialog
          open={confirmDeactivate}
          onClose={() => setConfirmDeactivate(false)}
          onConfirm={() => {
            deactivate.mutate();
            setConfirmDeactivate(false);
          }}
          title="Desactivar usuario"
          description="El usuario ya no podrá iniciar sesión. Podés reactivarlo más tarde."
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
          title="Reactivar usuario"
          description="El usuario podrá volver a iniciar sesión."
          confirmLabel="Reactivar"
          variant="default"
          isPending={reactivate.isPending}
        />
      </CardContent>
    </Card>
  );
}
