import { useState, type FormEvent } from 'react';
import type { CreateStorePayload, Store, StoreKind } from '@surmoda/contracts';
import { Alert, Button } from '@/shared/ui';
import { CodeField } from './CodeField';
import { NameField } from './NameField';
import { KindSelect } from './KindSelect';

interface StoreFormProps {
  initialValues?: Partial<Pick<Store, 'code' | 'name' | 'kind'>>;
  mode: 'create' | 'edit';
  isPending: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: StoreFormPayload) => void;
}

export interface StoreFormPayload {
  code: string;
  name: string;
  kind: StoreKind;
}

export function StoreForm({
  initialValues,
  mode,
  isPending,
  errorMessage,
  onSubmit,
}: StoreFormProps) {
  const [code, setCode] = useState((initialValues?.code ?? '').toUpperCase());
  const [name, setName] = useState(initialValues?.name ?? '');
  const [kind, setKind] = useState<StoreKind>(initialValues?.kind ?? 'branch');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({ code: code.trim().toUpperCase(), name: name.trim(), kind } satisfies CreateStorePayload);
  };

  const submitLabel = mode === 'create' ? 'Crear tienda' : 'Guardar cambios';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <CodeField value={code} onChange={setCode} />
      <NameField value={name} onChange={setName} />
      <KindSelect value={kind} onChange={setKind} disabled={mode === 'edit'} />
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <Button type="submit" variant="primary" isLoading={isPending} size="md" className="w-full">
        {isPending ? 'Guardando...' : submitLabel}
      </Button>
    </form>
  );
}
