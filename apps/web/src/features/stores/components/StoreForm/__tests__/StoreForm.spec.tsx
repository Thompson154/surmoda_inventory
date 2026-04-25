import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreForm } from '../index';
import { renderWithProviders } from '@/test/utils';

describe('StoreForm', () => {
  it('renders code, name, and kind fields with the create button', () => {
    renderWithProviders(<StoreForm mode="create" isPending={false} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear tienda/i })).toBeInTheDocument();
  });

  it('uppercases the code as the user types and submits a normalized payload', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<StoreForm mode="create" isPending={false} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/código/i), 'newstore');
    await user.type(screen.getByLabelText(/nombre/i), 'Nueva Sucursal');
    await user.click(screen.getByRole('button', { name: /crear tienda/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      code: 'NEWSTORE',
      name: 'Nueva Sucursal',
      kind: 'branch',
    });
  });

  it('disables the kind selector in edit mode (kind is immutable)', () => {
    renderWithProviders(
      <StoreForm
        mode="edit"
        isPending={false}
        initialValues={{ code: 'PRADO', name: 'Sucursal Prado', kind: 'branch' }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/tipo/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('shows the error message when provided', () => {
    renderWithProviders(
      <StoreForm
        mode="create"
        isPending={false}
        errorMessage="Ese código ya está en uso."
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Ese código ya está en uso.')).toBeInTheDocument();
  });
});
