import { useState, type FormEvent } from 'react';
import { useCreateUser } from '../hooks/useUsers';
import { useStores } from '../hooks/useStores';
import type { CreateUserPayload, Role } from '../types';
import type { HttpError } from '@/shared/services/httpClient';

interface AssignmentDraft {
  storeId: string;
  role: Role;
}

export function UserForm() {
  const create = useCreateUser();
  const stores = useStores();
  const firstStoreId = stores.data[0]?.id ?? '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([
    { storeId: firstStoreId, role: 'vendedora' },
  ]);

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

  const errorMessage = create.error
    ? mapCreateError((create.error as HttpError).code)
    : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-lg">
      <Field label="Email">
        <input
          type="email"
          required
          autoComplete="off"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
        />
      </Field>

      <Field label="Nombre completo">
        <input
          type="text"
          required
          minLength={1}
          maxLength={120}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
        />
      </Field>

      <Field label="Contraseña inicial (mín. 8 caracteres)">
        <input
          type="text"
          required
          minLength={8}
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-700 focus:outline-none"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
        ¿Es admin global? (sin asignación a tienda)
      </label>

      {!isAdmin && (
        <fieldset className="flex flex-col gap-3 rounded border border-slate-200 p-3">
          <legend className="text-sm text-slate-700">Asignaciones de tienda</legend>
          {assignments.map((a, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={a.storeId}
                onChange={(e) => updateAssignment(idx, { storeId: e.target.value })}
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              >
                {stores.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={a.role}
                onChange={(e) => updateAssignment(idx, { role: e.target.value as Role })}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="vendedora">vendedora</option>
                <option value="encargada">encargada</option>
              </select>
              {assignments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAssignment(idx)}
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  aria-label={`Quitar asignación ${idx + 1}`}
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAssignment}
            className="self-start rounded border border-dashed border-slate-400 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            + Agregar otra tienda
          </button>
        </fieldset>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={create.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-base font-medium text-white disabled:bg-slate-400"
      >
        {create.isPending ? 'Creando...' : 'Crear usuario'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function mapCreateError(code?: string): string {
  switch (code) {
    case 'USER_CREATE_DUPLICATE_EMAIL':
      return 'Ya existe un usuario con ese email.';
    case 'USER_PASSWORD_TOO_SHORT':
      return 'La contraseña debe tener al menos 8 caracteres.';
    case 'VALIDATION_ERROR':
      return 'Revisá los campos del formulario.';
    default:
      return 'No pudimos crear el usuario. Intentá nuevamente.';
  }
}
