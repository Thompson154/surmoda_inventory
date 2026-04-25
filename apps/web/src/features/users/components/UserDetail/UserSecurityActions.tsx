import { Button } from '@/shared/ui';

interface UserSecurityActionsProps {
  onResetPassword: () => void;
}

export function UserSecurityActions({ onResetPassword }: UserSecurityActionsProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-slate-800">Acciones de seguridad</h2>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onResetPassword}
          className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
        >
          Resetear contraseña
        </Button>
        <p className="mt-1 text-xs text-slate-500">
          Genera una nueva contraseña y cierra todas las sesiones del usuario.
        </p>
      </div>
    </section>
  );
}
