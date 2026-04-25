import { useState, type FormEvent } from 'react';
import { useLogin } from '../hooks/useLogin';
import { Alert, Button, Field, Input } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  const errorMessage = useErrorMessage(login.error as HttpError | null | undefined);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <Field label="Email" htmlFor="login-email">
        <Input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <Button type="submit" isLoading={login.isPending} size="md" className="py-2 text-base">
        {login.isPending ? 'Ingresando...' : 'Ingresar'}
      </Button>
    </form>
  );
}
