import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useUser } from '../hooks/useUsers';
import { AssignmentsManager } from '../components/AssignmentsManager';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { UserProfileSection } from '../components/UserDetail/UserProfileSection';
import { UserStatusActions } from '../components/UserDetail/UserStatusActions';
import { UserSecurityActions } from '../components/UserDetail/UserSecurityActions';
import { Alert } from '@/shared/ui';

export function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id ?? '';
  const query = useUser(userId);
  const [resetOpen, setResetOpen] = useState(false);

  if (!userId) {
    return <main className="p-4">ID inválido.</main>;
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4 text-slate-900">
        <header className="flex flex-col gap-1">
          <Link
            to="/users"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors duration-150"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
          <h1 className="text-xl font-semibold">Detalle del usuario</h1>
        </header>

        {query.isLoading && <p className="text-sm text-slate-500">Cargando...</p>}
        {query.isError && (
          <Alert variant="error">No pudimos cargar el usuario.</Alert>
        )}

        {query.data && (
          <div className="flex flex-col gap-4">
            <UserProfileSection user={query.data} />
            <UserStatusActions user={query.data} />
            <AssignmentsManager userId={userId} isUserAdmin={query.data.isAdmin} />
            <UserSecurityActions onResetPassword={() => setResetOpen(true)} />
          </div>
        )}

        {resetOpen && query.data && (
          <ResetPasswordModal
            userId={userId}
            userEmail={query.data.email}
            onClose={() => setResetOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
