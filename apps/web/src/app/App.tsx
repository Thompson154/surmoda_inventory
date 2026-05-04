import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { usePermissions } from '@/shared/auth/usePermissions';
import { Skeleton } from '@/shared/ui';

// WHY: vendedora va al scanner; encargada/admin a inventario. Antes el
// redirect estático mandaba a 'inventario' y vendedora caía en loop.
function SedeRoleRedirect() {
  const { storeId } = useParams<{ storeId: string }>();
  const { role } = usePermissions();
  if (!storeId) return <Navigate to="/sedes" replace />;
  const target = role === 'vendedora' ? 'scanner' : 'inventario';
  return <Navigate to={target} replace />;
}

// Eager: routes hit on every login.
// Login is the entry path; SedePicker / Inventory / Sales lead the warm path
// for vendedoras (the majority of users); the AppShell already pulls them.
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SedePickerPage } from '@/features/inventory/pages/SedePickerPage';
import { SedeInventoryPage } from '@/features/inventory/pages/SedeInventoryPage';
import { DeliveriesPage } from '@/features/deliveries/pages/DeliveriesPage';
import { SalesRegisterPage } from '@/features/sales/pages/SalesRegisterPage';
import { SalesDashboardPage } from '@/features/sales/pages/SalesDashboardPage';

// Lazy: return-requests module — not hit on the normal vendedora flow
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

// Lazy: admin-only or low-frequency surfaces. Each becomes its own JS chunk
// so a vendedora's first paint isn't burdened with the catalog/users/audit
// editors she will never open. Constitution PARTE II requires FCP < 3s on 3G.
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

/**
 * Generic skeleton shown while a lazy-loaded route fetches its chunk. The
 * Skeleton component already exists in shared/ui; we wrap it in the same
 * mobile container the real pages use so the layout doesn't jump on swap.
 */
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
              <SedeInventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sedes/:storeId/entregas"
          element={
            <Authenticated>
              <DeliveriesPage />
            </Authenticated>
          }
        />
        <Route
          path="/sedes/:storeId/ventas"
          element={
            <Authenticated>
              <SalesDashboardPage />
            </Authenticated>
          }
        />
        <Route
          path="/sedes/:storeId/scanner"
          element={
            <Authenticated>
              <SalesRegisterPage />
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
