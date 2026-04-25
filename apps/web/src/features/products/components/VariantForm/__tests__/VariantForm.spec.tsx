import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VariantForm } from '../index';
import { renderWithProviders } from '@/test/utils';

describe('VariantForm', () => {
  it('renders size, color, price and image fields with the create button', () => {
    renderWithProviders(<VariantForm mode="create" isPending={false} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/talla/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/color/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/precio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/imagen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar variante/i })).toBeInTheDocument();
  });

  it('disables size and color in edit mode (immutable fields)', () => {
    renderWithProviders(
      <VariantForm
        mode="edit"
        isPending={false}
        initialValues={{ size: 'm', color: 'azul', priceCents: 25000, imagePath: null }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/talla/i)).toBeDisabled();
    expect(screen.getByLabelText(/color/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('converts decimal price input to integer cents on submit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<VariantForm mode="create" isPending={false} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/color/i), 'azul');
    await user.type(screen.getByLabelText(/precio/i), '250.50');
    await user.click(screen.getByRole('button', { name: /agregar variante/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]?.[0];
    expect(payload.color).toBe('azul');
    expect(payload.priceCents).toBe(25050);
    expect(payload.image).toBeNull();
  });
});
