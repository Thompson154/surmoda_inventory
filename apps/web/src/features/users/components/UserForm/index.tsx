import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateUser } from '../../hooks/useUsers';
import type { CreateUserPayload } from '../../types';
import { EmailField } from './EmailField';
import { FullNameField } from './FullNameField';
import { PasswordField } from './PasswordField';
import { AdminToggle } from './AdminToggle';
import { AssignmentsDraftList, type AssignmentDraft } from './AssignmentsDraftList';
import type { HttpError } from '@/shared/services/httpClient';
import { Alert, Button } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import { useStores } from '@/features/stores/hooks/useStores';

export function UserForm() {
  const navigate = useNavigate();
  const create = useCreateUser({
    onSuccess: (user) => navigate(`/users/${user.id}`, { replace: true }),
  });
  // WHY: only branches receive user assignments — warehouse is admin-internal.
  const stores = useStores({ kind: 'branch' });
  const firstStoreId = stores.data?.items[0]?.id ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([
    { storeId: '', role: 'vendedora' },
  ]);

  // Sync the first draft assignment once stores load.
  useEffect(() => {
    if (firstStoreId && assignments[0]?.storeId === '') {
      setAssignments((prev) =>
        prev.map((a, idx) => (idx === 0 ? { ...a, storeId: firstStoreId } : a)),
      );
    }
  }, [firstStoreId, assignments]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: CreateUserPayload = {
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      isAdmin,
      assignments: isAdmin ? undefined : assignments,
    };
    create.mutate(payload);
  };

  const updateAssignment = (idx: number, patch: Partial<AssignmentDraft>) => {
    setAssignments((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const addAssignment = () => {
    setAssignments((prev) => [...prev, { storeId: firstStoreId, role: 'vendedora' }]);
  };

  const removeAssignment = (idx: number) => {
    setAssignments((prev) => prev.filter((_, i) => i !== idx));
  };

  const errorMessage = useErrorMessage(create.error as HttpError | null | undefined);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <EmailField value={email} onChange={setEmail} />
      <FullNameField value={fullName} onChange={setFullName} />
      <PasswordField value={password} onChange={setPassword} />
      <AdminToggle value={isAdmin} onChange={setIsAdmin} />
      {!isAdmin && (
        <AssignmentsDraftList
          assignments={assignments}
          onUpdate={updateAssignment}
          onAdd={addAssignment}
          onRemove={removeAssignment}
        />
      )}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <Button
        type="submit"
        variant="primary"
        isLoading={create.isPending}
        size="md"
        className="w-full"
      >
        {create.isPending ? 'Creando...' : 'Crear usuario'}
      </Button>
    </form>
  );
}
