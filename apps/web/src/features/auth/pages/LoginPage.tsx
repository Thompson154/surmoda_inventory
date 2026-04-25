import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="flex w-full max-w-sm flex-col gap-6 rounded-lg bg-white p-6 shadow">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Sistema de Inventarios y Ventas</h1>
          <p className="text-sm text-slate-500">Iniciá sesión para continuar.</p>
        </header>
        <LoginForm />
      </section>
    </main>
  );
}
