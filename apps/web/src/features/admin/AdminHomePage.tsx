import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Package,
  ScrollText,
  Store as StoreIcon,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/shared/ui';
import { AppShell } from '@/shared/layout/AppShell';

export function AdminHomePage() {
  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-slate-900">
        <header className="flex flex-col gap-1">
          <Link
            to="/sedes"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a sucursales
          </Link>
          <h1 className="text-xl font-semibold">Panel admin</h1>
          <p className="text-sm text-slate-500">
            Gestión maestra del sistema. Aquí solo entra el admin.
          </p>
        </header>

        <Link to="/users" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gestionar usuarios</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Crear, editar y desactivar cuentas
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/stores" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <StoreIcon className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gestionar tiendas</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sucursales y almacén central
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/products" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gestionar catálogo</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Productos, variantes, precios e imágenes
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/reportes" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Reportes</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Análisis cross-sucursal — ventas, top productos, ranking de vendedoras
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/auditoria" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <ScrollText className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Auditoría del sistema</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Log inmutable de acciones — login, ediciones, ventas, entregas
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </main>
    </AppShell>
  );
}
