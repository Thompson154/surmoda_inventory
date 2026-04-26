import { Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { UsersListPage } from '@/features/users/pages/UsersListPage';
import { UserCreatePage } from '@/features/users/pages/UserCreatePage';
import { UserDetailPage } from '@/features/users/pages/UserDetailPage';
import { StoresListPage } from '@/features/stores/pages/StoresListPage';
import { StoreCreatePage } from '@/features/stores/pages/StoreCreatePage';
import { StoreDetailPage } from '@/features/stores/pages/StoreDetailPage';
import { ProductsListPage } from '@/features/products/pages/ProductsListPage';
import { ProductCreatePage } from '@/features/products/pages/ProductCreatePage';
import { ProductDetailPage } from '@/features/products/pages/ProductDetailPage';
import { SedePickerPage } from '@/features/inventory/pages/SedePickerPage';
import { SedeInventoryPage } from '@/features/inventory/pages/SedeInventoryPage';
import { DeliveriesPage } from '@/features/deliveries/pages/DeliveriesPage';
import { SalesRegisterPage } from '@/features/sales/pages/SalesRegisterPage';
import { SalesDashboardPage } from '@/features/sales/pages/SalesDashboardPage';
import { AdminHomePage } from '@/features/admin/AdminHomePage';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Authenticated><Navigate to="/sedes" replace /></Authenticated>} />
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
      <Route
        path="/sedes/:storeId"
        element={<Navigate to="inventario" replace />}
      />
      <Route
        path="/sedes/:storeId/inventario"
        element={
          <Authenticated>
            <SedeInventoryPage />
          </Authenticated>
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

      {/* Admin CRUD */}
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
      <Route
        path="/stores"
        element={
          <Authenticated requireAdmin>
            <StoresListPage />
          </Authenticated>
        }
      />
      <Route
        path="/stores/new"
        element={
          <Authenticated requireAdmin>
            <StoreCreatePage />
          </Authenticated>
        }
      />
      <Route
        path="/stores/:id"
        element={
          <Authenticated requireAdmin>
            <StoreDetailPage />
          </Authenticated>
        }
      />
      <Route
        path="/products"
        element={
          <Authenticated requireAdmin>
            <ProductsListPage />
          </Authenticated>
        }
      />
      <Route
        path="/products/new"
        element={
          <Authenticated requireAdmin>
            <ProductCreatePage />
          </Authenticated>
        }
      />
      <Route
        path="/products/:id"
        element={
          <Authenticated requireAdmin>
            <ProductDetailPage />
          </Authenticated>
        }
      />

      <Route path="*" element={<Navigate to="/sedes" replace />} />
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
  if (requireAdmin && !user.isAdmin) return <Navigate to="/sedes" replace />;
  return <>{children}</>;
}
