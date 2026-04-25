import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProductForm } from '../index';
import { renderWithProviders } from '@/test/utils';

describe('ProductForm', () => {
  it('renders code, name, description and the create button', () => {
    renderWithProviders(<ProductForm mode="create" isPending={false} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear producto/i })).toBeInTheDocument();
  });

  it('uppercases the code as the user types and submits a normalized payload', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ProductForm mode="create" isPending={false} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/código/i), 'jn001');
    await user.type(screen.getByLabelText(/nombre/i), 'Jean Bota');
    await user.click(screen.getByRole('button', { name: /crear producto/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      code: 'JN001',
      name: 'Jean Bota',
      description: undefined,
    });
  });

  it('disables the code field in edit mode (code stays editable but admin discouraged)', () => {
    renderWithProviders(
      <ProductForm
        mode="edit"
        isPending={false}
        initialValues={{ code: 'JN001', name: 'Jean', description: '' }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/código/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('shows the error message when provided', () => {
    renderWithProviders(
      <ProductForm
        mode="create"
        isPending={false}
        errorMessage="Ese código ya está en uso."
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Ese código ya está en uso.')).toBeInTheDocument();
  });
});
