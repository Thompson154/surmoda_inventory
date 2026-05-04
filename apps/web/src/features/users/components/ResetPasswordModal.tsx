import { useState, type FormEvent } from 'react';
import { useResetPassword } from '../hooks/useUsers';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { Alert, Button, Field, Input, Modal } from '@/shared/ui';
import type { HttpError } from '@/shared/services/httpClient';

interface ResetPasswordModalProps {
  userId: string;
  userEmail: string;
  onClose: () => void;
}

export function ResetPasswordModal({ userId, userEmail, onClose }: ResetPasswordModalProps) {
  const reset = useResetPassword(userId);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tooShort || mismatch || newPassword.length === 0) return;
    reset.mutate(newPassword, {
      onSuccess: () => setDone(true),
    });
  };

  const resetError = useErrorMessage(reset.error as HttpError | null | undefined);

  return (
    <Modal isOpen onClose={onClose} title={done ? 'Contraseña reseteada' : 'Resetear contraseña'}>
      {!done ? (
        <>
          <p className="mb-4 text-sm text-text-secondary">
            Vas a generar una nueva contraseña para <strong>{userEmail}</strong>. Todas las sesiones
            activas del usuario se van a cerrar.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Field label="Nueva contraseña (mín. 8 caracteres)" htmlFor="reset-new-password">
              <Input
                id="reset-new-password"
                type="text"
                required
                minLength={8}
                autoComplete="off"
                error={tooShort}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirmar contraseña" htmlFor="reset-confirm-password">
              <Input
                id="reset-confirm-password"
                type="text"
                required
                autoComplete="off"
                error={mismatch}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            {tooShort && <Alert variant="error">Mínimo 8 caracteres.</Alert>}
            {mismatch && <Alert variant="error">Las contraseñas no coinciden.</Alert>}
            {resetError && <Alert variant="error">{resetError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={reset.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={reset.isPending}
                disabled={
                  tooShort || mismatch || newPassword.length === 0 || confirmPassword.length === 0
                }
              >
                {reset.isPending ? 'Reseteando...' : 'Resetear contraseña'}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-text-secondary">
            La contraseña de <strong>{userEmail}</strong> fue actualizada. Comunicale la nueva
            contraseña al usuario por un canal seguro.
          </p>
          <Alert variant="warning">
            Por seguridad, esta contraseña <strong>no se vuelve a mostrar</strong>. Si la perdés,
            hay que repetir el reset.
          </Alert>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="primary" onClick={onClose}>
              Listo
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
