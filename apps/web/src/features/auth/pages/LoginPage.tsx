import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoginForm } from '../components/LoginForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui';

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-base px-4 py-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-[420px]">
        <div className="text-center">
          <p className="text-2xl font-semibold text-slate-900">Sur Moda</p>
          <p className="text-sm text-slate-500 mt-1">Sistema de inventario y ventas</p>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Iniciá sesión</CardTitle>
            <CardDescription>Accedé a tu sucursal asignada</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
