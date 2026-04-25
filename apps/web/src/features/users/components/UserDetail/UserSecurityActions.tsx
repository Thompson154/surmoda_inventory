import { KeyRound } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui';

interface UserSecurityActionsProps {
  onResetPassword: () => void;
}

export function UserSecurityActions({ onResetPassword }: UserSecurityActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguridad</CardTitle>
        <CardDescription>
          Genera una nueva contraseña y cierra todas las sesiones del usuario.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="secondary"
          leftIcon={<KeyRound className="h-4 w-4" />}
          onClick={onResetPassword}
        >
          Resetear contraseña
        </Button>
      </CardContent>
    </Card>
  );
}
