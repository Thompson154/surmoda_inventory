import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUser } from '../hooks/useUsers';
import { AssignmentsManager } from '../components/AssignmentsManager';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { UserProfileSection } from '../components/UserDetail/UserProfileSection';
import { UserStatusActions } from '../components/UserDetail/UserStatusActions';
import { UserSecurityActions } from '../components/UserDetail/UserSecurityActions';

export function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id ?? '';
  const query = useUser(userId);
  const [resetOpen, setResetOpen] = useState(false);

  if (!userId) {
    return <main className="p-4">ID inválido.</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 text-slate-900">
      <header className="flex flex-col gap-1">
        <Link to="/users" className="text-sm text-slate-500 hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="text-xl font-semibold">Detalle del usuario</h1>
      </header>

      {query.isLoading && <p className="text-sm text-slate-500">Cargando...</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-red-600">
          No pudimos cargar el usuario.
        </p>
      )}

      {query.data && (
        <article className="flex flex-col gap-6 rounded border border-slate-200 bg-white p-4">
          <UserProfileSection user={query.data} />
          <hr className="border-slate-200" />
          <UserStatusActions user={query.data} />
          <hr className="border-slate-200" />
          <AssignmentsManager userId={userId} isUserAdmin={query.data.isAdmin} />
          <hr className="border-slate-200" />
          <UserSecurityActions onResetPassword={() => setResetOpen(true)} />
        </article>
      )}

      {resetOpen && query.data && (
        <ResetPasswordModal
          userId={userId}
          userEmail={query.data.email}
          onClose={() => setResetOpen(false)}
        />
      )}
    </main>
  );
}
