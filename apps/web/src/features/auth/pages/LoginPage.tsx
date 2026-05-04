import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoginForm } from '../components/LoginForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui';

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-primary-soft via-surface-base to-surface-base flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-[420px]">
        <div className="text-center animate-fade-in">
          <p className="text-2xl font-semibold text-text-primary">Sur Moda</p>
          <p
            className="text-sm text-text-muted mt-1 animate-slide-up"
            style={{ animationDelay: '120ms' }}
          >
            Sistema de inventario y ventas
          </p>
        </div>
        <Card className="w-full animate-scale-in shadow-xl border border-surface-border rounded-2xl">
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
