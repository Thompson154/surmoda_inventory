import { Link } from 'react-router-dom';
import { UserForm } from '../components/UserForm';

export function UserCreatePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 text-slate-900">
      <header className="flex flex-col gap-1">
        <Link to="/users" className="text-sm text-slate-500 hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="text-xl font-semibold">Nuevo usuario</h1>
        <p className="text-sm text-slate-500">
          El admin define email + contraseña inicial. La encargada/vendedora la cambia después.
        </p>
      </header>
      <UserForm />
    </main>
  );
}
