import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { UsersListPage } from '@/features/users/pages/UsersListPage';
import { UserCreatePage } from '@/features/users/pages/UserCreatePage';
import { UserDetailPage } from '@/features/users/pages/UserDetailPage';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import type { ReactNode } from 'react';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Authenticated><HomePage /></Authenticated>} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/users"
        element={
          <Authenticated requireAdmin>
            <UsersListPage />
          </Authenticated>
        }
      />
      <Route
        path="/users/new"
        element={
          <Authenticated requireAdmin>
            <UserCreatePage />
          </Authenticated>
        }
      />
      <Route
        path="/users/:id"
        element={
          <Authenticated requireAdmin>
            <UserDetailPage />
          </Authenticated>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Authenticated({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !user.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomePage() {
  const user = useAuthStore((s) => s.user);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
      <h1 className="text-xl font-semibold">Hola, {user?.fullName}</h1>
      <p className="text-sm text-slate-500">
        {user?.isAdmin
          ? 'Sos admin global. Podés gestionar usuarios y, cuando estén listas, tiendas/inventario.'
          : 'Tus tiendas asignadas aparecerán acá cuando ship la feature 002 (Tiendas).'}
      </p>
      {user?.isAdmin && (
        <Link
          to="/users"
          className="self-start rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Gestionar usuarios →
        </Link>
      )}
      {!user?.isAdmin && user?.assignments && user.assignments.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {user.assignments.map((a) => (
            <li key={a.storeId} className="rounded bg-slate-100 px-3 py-2">
              <span className="font-medium">{a.storeId}</span> — {a.role}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
