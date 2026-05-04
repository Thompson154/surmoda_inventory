import { useState, useEffect, type FormEvent } from 'react';
import { Pencil, Save } from 'lucide-react';
import { useUpdateUser } from '../../hooks/useUsers';
import type { User } from '../../types';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@/shared/ui';
import type { HttpError } from '@/shared/services/httpClient';

interface UserProfileSectionProps {
  user: User;
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-text-muted">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function UserProfileSection({ user }: UserProfileSectionProps) {
  const update = useUpdateUser(user.id);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);

  useEffect(() => {
    setFullName(user.fullName);
    setIsAdmin(user.isAdmin);
  }, [user.fullName, user.isAdmin]);

  const updateError = useErrorMessage(update.error as HttpError | null | undefined);

  const handleSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update.mutate({ fullName: fullName.trim(), isAdmin }, { onSuccess: () => setEditing(false) });
  };

  const handleCancel = () => {
    setFullName(user.fullName);
    setIsAdmin(user.isAdmin);
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Datos personales</CardTitle>
          {!editing && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="flex flex-col gap-3">
            <ProfileField label="Nombre completo">{user.fullName}</ProfileField>
            <ProfileField label="Email">{user.email}</ProfileField>
            <ProfileField label="Tipo de cuenta">
              {user.isAdmin ? (
                <Badge variant="info">Admin global</Badge>
              ) : (
                <Badge variant="default">Staff de sucursal</Badge>
              )}
            </ProfileField>
            <ProfileField label="Estado">
              {user.isActive ? (
                <Badge variant="success">Activo</Badge>
              ) : (
                <Badge variant="default">Inactivo</Badge>
              )}
            </ProfileField>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <Field label="Nombre completo" htmlFor="edit-fullname">
              <Input
                id="edit-fullname"
                type="text"
                required
                minLength={1}
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              Admin global
            </label>
            {updateError && <Alert variant="error">{updateError}</Alert>}
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={<Save className="h-3.5 w-3.5" />}
                isLoading={update.isPending}
              >
                {update.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
