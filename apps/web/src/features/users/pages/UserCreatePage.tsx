import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { UserForm } from '../components/UserForm';
import { Card, CardContent } from '@/shared/ui';

export function UserCreatePage() {
  return (
    <div className="min-h-screen bg-surface-base">
      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4 text-slate-900">
        <header className="flex flex-col gap-1">
          <Link
            to="/users"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors duration-150"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
          <h1 className="text-xl font-semibold">Nuevo usuario</h1>
          <p className="text-sm text-slate-500">
            El admin define email + contraseña inicial. La encargada/vendedora la cambia después.
          </p>
        </header>
        <Card>
          <CardContent>
            <UserForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
