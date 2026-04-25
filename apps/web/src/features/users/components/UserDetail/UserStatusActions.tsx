import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { Alert, Button } from '@/shared/ui';
import { useDeactivateUser, useReactivateUser } from '../../hooks/useUsers';
import type { User } from '../../types';
import type { HttpError } from '@/shared/services/httpClient';

interface UserStatusActionsProps {
  user: User;
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function UserStatusActions({ user }: UserStatusActionsProps) {
  const deactivate = useDeactivateUser(user.id);
  const reactivate = useReactivateUser(user.id);

  const deactivateError = useErrorMessage(deactivate.error as HttpError | null | undefined);

  return (
    <>
      <ProfileField label="Estado">
        <div className="flex items-center gap-2">
          <span
            className={
              user.isActive
                ? 'rounded bg-green-100 px-2 py-0.5 text-xs text-green-800'
                : 'rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700'
            }
          >
            {user.isActive ? 'Activo' : 'Inactivo'}
          </span>
          {user.isActive ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
            >
              {deactivate.isPending ? 'Desactivando...' : 'Desactivar'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="bg-green-50 text-green-700 hover:bg-green-100"
            >
              {reactivate.isPending ? 'Activando...' : 'Reactivar'}
            </Button>
          )}
        </div>
      </ProfileField>
      {deactivateError && <Alert variant="error">{deactivateError}</Alert>}
    </>
  );
}
