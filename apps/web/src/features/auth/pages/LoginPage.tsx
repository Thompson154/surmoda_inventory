import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoginForm } from '../components/LoginForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui';

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;

  return (
    <main className="relative min-h-[100dvh] bg-surface-base flex items-center justify-center p-4 overflow-hidden selection:bg-brand-primary/20 selection:text-brand-primary">
      {/* Ambient background glows for macOS depth */}
      <div
        className="fixed -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-brand-primary/15 dark:bg-brand-primary/25 blur-[140px] pointer-events-none rounded-full"
        aria-hidden="true"
      />
      <div
        className="fixed -bottom-20 -right-20 w-[400px] h-[300px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px] pointer-events-none rounded-full"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-[420px] animate-scale-in">
        {/* Brand emblem & title */}
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-brand-primary to-violet-600 flex items-center justify-center text-white font-extrabold text-xl shadow-xl shadow-indigo-500/25 mb-3.5 tracking-tight active:scale-95 transition-transform">
            SM
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Sur Moda</h1>
          <p className="text-sm text-text-muted mt-1">Sistema de inventario y ventas</p>
        </div>

        {/* Card */}
        <Card className="w-full relative overflow-hidden backdrop-blur-xl bg-surface-raised/85 dark:bg-surface-raised/75 border border-surface-border/80 shadow-2xl rounded-3xl before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-brand-primary before:to-transparent">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-text-primary">Iniciá sesión</CardTitle>
            <CardDescription className="text-xs text-text-muted">
              Accedé a tu sucursal asignada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
