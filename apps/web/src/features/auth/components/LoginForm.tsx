import { useState, type FormEvent } from 'react';
import { useLogin } from '../hooks/useLogin';
import { Alert, Button, Field, Input } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';

interface LoginFormProps {
  immersive?: boolean;
}

export function LoginForm({ immersive = false }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  const errorMessage = useErrorMessage(login.error as HttpError | null | undefined);

  if (immersive) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
        <div>
          <label htmlFor="login-email" className="sr-only">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-5 rounded-full bg-[#110C19]/80 border border-white/10 text-white placeholder:text-white/45 text-base sm:text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition-all"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="sr-only">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            minLength={1}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-5 rounded-full bg-[#110C19]/80 border border-white/10 text-white placeholder:text-white/45 text-base sm:text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition-all"
          />
        </div>
        {errorMessage && (
          <Alert variant="error" className="rounded-2xl text-xs">
            {errorMessage}
          </Alert>
        )}
        <div className="pt-2 flex justify-center">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={login.isPending}
            className="w-full sm:w-auto sm:min-w-[200px] h-11 px-10 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#9D74F7] hover:to-[#7C3AED] border-0 text-white font-semibold tracking-wide shadow-lg shadow-violet-600/35 active:scale-[0.97] transition-all"
          >
            {login.isPending ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5 w-full">
      <Field label="Email" htmlFor="login-email">
        <Input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="nombre@surmoda.com.bo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Contraseña" htmlFor="login-password">
        <Input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          minLength={1}
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={login.isPending}
        className="w-full mt-1 h-11 rounded-full font-semibold tracking-wide shadow-md shadow-brand-primary/20 active:scale-[0.98] transition-all"
      >
        {login.isPending ? 'Ingresando...' : 'Ingresar al sistema'}
      </Button>
    </form>
  );
}
