import { Power, RotateCcw } from 'lucide-react';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { useDeactivateUser, useReactivateUser } from '../../hooks/useUsers';
import type { User } from '../../types';
import type { HttpError } from '@/shared/services/httpClient';

interface UserStatusActionsProps {
  user: User;
}

export function UserStatusActions({ user }: UserStatusActionsProps) {
  const deactivate = useDeactivateUser(user.id);
  const reactivate = useReactivateUser(user.id);

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
              onClick={() => deactivate.mutate()}
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
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              isLoading={reactivate.isPending}
            >
              {reactivate.isPending ? 'Activando...' : 'Reactivar'}
            </Button>
          )}
        </div>
        {deactivateError && <Alert variant="error">{deactivateError}</Alert>}
      </CardContent>
    </Card>
  );
}
