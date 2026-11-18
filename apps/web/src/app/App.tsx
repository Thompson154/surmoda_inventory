import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { usePermissions, canSwitchStores } from '@/shared/auth/usePermissions';
import { Skeleton } from '@/shared/ui';

// Redirección por rol: vendedora va a scanner; encargada/admin a inventario
function SedeRoleRedirect() {
  const { storeId } = useParams<{ storeId: string }>();
  const { role } = usePermissions();
  if (!storeId) return <Navigate to="/sedes" replace />;
  const target = role === 'vendedora' ? 'scanner' : 'inventario';
  return <Navigate to={target} replace />;
}

/** Locks single-store staff to their assigned storeId in URL navigation. */
function StoreScopeGuard({ children }: { children: ReactNode }) {
  const { storeId } = useParams<{ storeId: string }>();
  const user = useAuthStore((s) => s.user);
  if (
    user &&
    storeId &&
    !canSwitchStores(user) &&
    !user.assignments.some((a) => a.storeId === storeId)
  ) {
    return <Navigate to="/sedes" replace />;
  }
  return <>{children}</>;
}

// Rutas de carga inmediata (flujo principal)
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SedePickerPage } from '@/features/inventory/pages/SedePickerPage';
import { SedeInventoryPage } from '@/features/inventory/pages/SedeInventoryPage';
import { DeliveriesPage } from '@/features/deliveries/pages/DeliveriesPage';
import { SalesRegisterPage } from '@/features/sales/pages/SalesRegisterPage';
import { SalesDashboardPage } from '@/features/sales/pages/SalesDashboardPage';

// Rutas diferidas (lazy)
const CreateReturnRequestPage = lazy(() =>
  import('@/features/return-requests/pages/CreateReturnRequestPage').then((m) => ({
    default: m.CreateReturnRequestPage,
  })),
);
const MyReturnRequestsPage = lazy(() =>
  import('@/features/return-requests/pages/MyReturnRequestsPage').then((m) => ({
    default: m.MyReturnRequestsPage,
  })),
);
const AdminReturnRequestsPage = lazy(() =>
  import('@/features/return-requests/pages/AdminReturnRequestsPage').then((m) => ({
    default: m.AdminReturnRequestsPage,
  })),
);
const ReviewReturnRequestPage = lazy(() =>
  import('@/features/return-requests/pages/ReviewReturnRequestPage').then((m) => ({
    default: m.ReviewReturnRequestPage,
  })),
);

// Módulos administrativos diferidos (code splitting)
const AdminHomePage = lazy(() =>
  import('@/features/admin/AdminHomePage').then((m) => ({ default: m.AdminHomePage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const AuditLogsPage = lazy(() =>
  import('@/features/audit/pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })),
);
const UsersListPage = lazy(() =>
  import('@/features/users/pages/UsersListPage').then((m) => ({ default: m.UsersListPage })),
);
const UserCreatePage = lazy(() =>
  import('@/features/users/pages/UserCreatePage').then((m) => ({ default: m.UserCreatePage })),
);
const UserDetailPage = lazy(() =>
  import('@/features/users/pages/UserDetailPage').then((m) => ({ default: m.UserDetailPage })),
);
const StoresListPage = lazy(() =>
  import('@/features/stores/pages/StoresListPage').then((m) => ({ default: m.StoresListPage })),
);
const StoreCreatePage = lazy(() =>
  import('@/features/stores/pages/StoreCreatePage').then((m) => ({ default: m.StoreCreatePage })),
);
const StoreDetailPage = lazy(() =>
  import('@/features/stores/pages/StoreDetailPage').then((m) => ({ default: m.StoreDetailPage })),
);
const ProductsListPage = lazy(() =>
  import('@/features/products/pages/ProductsListPage').then((m) => ({
    default: m.ProductsListPage,
  })),
);
const ProductCreatePage = lazy(() =>
  import('@/features/products/pages/ProductCreatePage').then((m) => ({
    default: m.ProductCreatePage,
  })),
);
const ProductDetailPage = lazy(() =>
  import('@/features/products/pages/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
);

// Skeleton de carga para rutas diferidas
function RouteFallback() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/"
          element={
            <Authenticated>
              <Navigate to="/sedes" replace />
            </Authenticated>
          }
        />
        <Route path="/login" element={<LoginPage />} />

        {/* Operación per-sede */}
        <Route
          path="/sedes"
          element={
            <Authenticated>
              <SedePickerPage />
            </Authenticated>
          }
        />
        <Route path="/sedes/:storeId" element={<SedeRoleRedirect />} />
        <Route
          path="/sedes/:storeId/inventario"
          element={
            <ProtectedRoute action="inventory:read" fallback="/sedes">
              <StoreScopeGuard>
                <SedeInventoryPage />
              </StoreScopeGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sedes/:storeId/entregas"
          element={
            <Authenticated>
              <StoreScopeGuard>
                <DeliveriesPage />
              </StoreScopeGuard>
            </Authenticated>
          }
        />
        <Route
          path="/sedes/:storeId/ventas"
          element={
            <Authenticated>
              <StoreScopeGuard>
                <SalesDashboardPage />
              </StoreScopeGuard>
            </Authenticated>
          }
        />
        <Route
          path="/sedes/:storeId/scanner"
          element={
            <Authenticated>
              <StoreScopeGuard>
                <SalesRegisterPage />
              </StoreScopeGuard>
            </Authenticated>
          }
        />

        {/* Panel admin */}
        <Route
          path="/admin"
          element={
            <Authenticated requireAdmin>
              <AdminHomePage />
            </Authenticated>
          }
        />

        {/* Reports — admin OR encargada (BE enforces on 403); vendedora gets 403 in-page. */}
        <Route
          path="/reportes"
          element={
            <ProtectedRoute action="reports:generate">
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        {/* Audit log viewer — admin OR encargada (BE enforces). */}
        <Route
          path="/auditoria"
          element={
            <Authenticated>
              <AuditLogsPage />
            </Authenticated>
          }
        />

        {/* Return requests — vendedora + encargada can request; admin reviews */}
        <Route
          path="/return-requests/new"
          element={
            <ProtectedRoute action="returns:request">
              <CreateReturnRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/return-requests/mine"
          element={
            <ProtectedRoute action="returns:request">
              <MyReturnRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/return-requests"
          element={
            <ProtectedRoute action="returns:review">
              <AdminReturnRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/return-requests/:id"
          element={
            <ProtectedRoute action="returns:review">
              <ReviewReturnRequestPage />
            </ProtectedRoute>
          }
        />

        {/* Admin CRUD */}
        <Route
          path="/users"
          element={
            <ProtectedRoute action="users:manage">
              <UsersListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/new"
          element={
            <ProtectedRoute action="users:manage">
              <UserCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:id"
          element={
            <ProtectedRoute action="users:manage">
              <UserDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores"
          element={
            <ProtectedRoute action="stores:edit">
              <StoresListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/new"
          element={
            <ProtectedRoute action="stores:edit">
              <StoreCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/:id"
          element={
            <ProtectedRoute action="stores:edit">
              <StoreDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute action="products:edit">
              <ProductsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/new"
          element={
            <ProtectedRoute action="products:edit">
              <ProductCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute action="products:edit">
              <ProductDetailPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/sedes" replace />} />
      </Routes>
    </Suspense>
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
  if (requireAdmin && !user.isAdmin) return <Navigate to="/sedes" replace />;
  return <>{children}</>;
}
