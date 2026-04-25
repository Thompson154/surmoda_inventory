import { useState, type FormEvent } from 'react';
import { useResetPassword } from '../hooks/useUsers';
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
  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tooShort || mismatch || newPassword.length === 0) return;
    reset.mutate(newPassword, {
      onSuccess: () => setDone(true),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {!done ? (
          <>
            <h2 id="reset-password-title" className="text-lg font-semibold text-slate-900">
              Resetear contraseña
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Vas a generar una nueva contraseña para <strong>{userEmail}</strong>. Todas las
              sesiones activas del usuario se van a cerrar.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700">Nueva contraseña (mín. 8 caracteres)</span>
                <input
                  type="text"
                  required
                  minLength={8}
                  autoComplete="off"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700">Confirmar contraseña</span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
                />
              </label>

              {tooShort && (
                <p role="alert" className="text-xs text-red-600">
                  Mínimo 8 caracteres.
                </p>
              )}
              {mismatch && (
                <p role="alert" className="text-xs text-red-600">
                  Las contraseñas no coinciden.
                </p>
              )}
              {reset.error && (
                <p role="alert" className="text-sm text-red-600">
                  {mapResetError((reset.error as HttpError).code)}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={reset.isPending}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    reset.isPending ||
                    tooShort ||
                    mismatch ||
                    newPassword.length === 0 ||
                    confirmPassword.length === 0
                  }
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-400"
                >
                  {reset.isPending ? 'Reseteando...' : 'Resetear contraseña'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 id="reset-password-title" className="text-lg font-semibold text-slate-900">
              Contraseña reseteada
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              La contraseña de <strong>{userEmail}</strong> fue actualizada. Comunicale la nueva
              contraseña al usuario por un canal seguro.
            </p>
            <p className="mt-2 rounded bg-amber-50 p-3 text-xs text-amber-800">
              Por seguridad, esta contraseña <strong>no se vuelve a mostrar</strong>. Si la perdés,
              hay que repetir el reset.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                Listo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function mapResetError(code?: string): string {
  switch (code) {
    case 'USER_NOT_FOUND':
      return 'El usuario no existe.';
    case 'USER_PASSWORD_TOO_SHORT':
    case 'VALIDATION_ERROR':
      return 'La contraseña debe tener al menos 8 caracteres.';
    default:
      return 'No pudimos resetear la contraseña.';
  }
}
