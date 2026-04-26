import { useState, type FormEvent } from 'react';
import type { Product } from '@surmoda/contracts';
import { CodeField } from './CodeField';
import { NameField } from './NameField';
import { DescriptionField } from './DescriptionField';
import { Alert, Button } from '@/shared/ui';

interface ProductFormProps {
  initialValues?: Partial<Pick<Product, 'code' | 'name' | 'description'>>;
  mode: 'create' | 'edit';
  isPending: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: ProductFormPayload) => void;
}

export interface ProductFormPayload {
  code: string;
  name: string;
  description?: string;
}

export function ProductForm({
  initialValues,
  mode,
  isPending,
  errorMessage,
  onSubmit,
}: ProductFormProps) {
  const [code, setCode] = useState((initialValues?.code ?? '').toUpperCase());
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedDescription = description.trim();
    onSubmit({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: trimmedDescription === '' ? undefined : trimmedDescription,
    });
  };

  const submitLabel = mode === 'create' ? 'Crear producto' : 'Guardar cambios';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <CodeField value={code} onChange={setCode} disabled={mode === 'edit'} />
      <NameField value={name} onChange={setName} />
      <DescriptionField value={description} onChange={setDescription} />
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <Button type="submit" variant="primary" isLoading={isPending} size="md" className="w-full">
        {isPending ? 'Guardando...' : submitLabel}
      </Button>
    </form>
  );
}
