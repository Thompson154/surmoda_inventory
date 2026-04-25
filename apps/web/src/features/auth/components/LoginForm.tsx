import { useState, type FormEvent } from 'react';
import { useLogin } from '../hooks/useLogin';
import type { HttpError } from '@/shared/services/httpClient';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  const errorMessage =
    login.error instanceof Error
      ? mapAuthError((login.error as HttpError).code)
      : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-700">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-700">Contraseña</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          minLength={1}
          className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={login.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-base font-medium text-white disabled:bg-slate-400"
      >
        {login.isPending ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
}

function mapAuthError(code?: string): string {
  switch (code) {
    case 'AUTH_LOGIN_INVALID_CREDENTIALS':
      return 'Email o contraseña incorrectos.';
    case 'AUTH_LOGIN_USER_INACTIVE':
      return 'Tu cuenta está inactiva. Contactá al administrador.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Demasiados intentos. Esperá un momento e intentá nuevamente.';
    default:
      return 'No pudimos iniciar sesión. Intentá nuevamente.';
  }
}
