import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { ChevronRight, Building2 } from 'lucide-react';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { UsersListPage } from '@/features/users/pages/UsersListPage';
import { UserCreatePage } from '@/features/users/pages/UserCreatePage';
import { UserDetailPage } from '@/features/users/pages/UserDetailPage';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { getStoreLabel } from '@/features/users/hooks/useStores';
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
} from '@/shared/ui';
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
    <div className="min-h-screen bg-surface-base">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-surface-raised/80 backdrop-blur border-b border-surface-border px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">Sur Moda</span>
          <span className="text-xs text-slate-500">Bienvenida, {user?.fullName}</span>
        </div>
        <LogoutButton />
      </header>

      {/* Body */}
      <main className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-4">
        {/* Admin: link to users */}
        {user?.isAdmin && (
          <Link to="/users" className="block">
            <Card className="hover:bg-surface-sunken transition-colors duration-150">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gestionar usuarios</p>
                  <p className="text-xs text-slate-500 mt-0.5">Crear, editar y desactivar cuentas</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Staff: list of assigned stores */}
        {!user?.isAdmin && user?.assignments && user.assignments.length > 0 && (
          <div className="flex flex-col gap-2">
            {user.assignments.map((a) => (
              <Card key={a.storeId} className="cursor-default">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {getStoreLabel(a.storeId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{a.role}</Badge>
                    <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Staff: no assignments yet */}
        {!user?.isAdmin && (!user?.assignments || user.assignments.length === 0) && (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="Sin tiendas asignadas"
                description="Pedile a tu admin que te asigne a una sucursal."
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
