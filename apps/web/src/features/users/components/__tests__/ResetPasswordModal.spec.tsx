// T100 — ResetPasswordModal component tests (R4 MSW)
// WHY: ensure password reset dialog renders, validates inputs, shows success state,
//      and allows cancellation.

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ResetPasswordModal } from '../ResetPasswordModal';
import { renderWithProviders } from '@/test/utils';

const DEFAULT_PROPS = {
  userId: 'user-1',
  userEmail: 'target@test.local',
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResetPasswordModal', () => {
  it('renders dialog with the reset title', () => {
    renderWithProviders(<ResetPasswordModal {...DEFAULT_PROPS} />);
    expect(screen.getByRole('heading', { name: /resetear contraseña/i })).toBeInTheDocument();
  });

  it('shows "Mínimo 8 caracteres." when password is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordModal {...DEFAULT_PROPS} />);

    await user.type(screen.getByLabelText(/nueva contraseña/i), 'short');
    // Click somewhere else to trigger the validation display
    await user.tab();

    await screen.findByText('Mínimo 8 caracteres.');
  });

  it('shows "Las contraseñas no coinciden." when passwords differ', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordModal {...DEFAULT_PROPS} />);

    await user.type(screen.getByLabelText(/nueva contraseña/i), 'longpassword123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'differentpassword');

    await screen.findByText('Las contraseñas no coinciden.');
  });

  it('disables submit when passwords do not match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordModal {...DEFAULT_PROPS} />);

    await user.type(screen.getByLabelText(/nueva contraseña/i), 'longpassword123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'different123456');

    const submitBtn = screen.getByRole('button', { name: /resetear contraseña/i });
    expect(submitBtn).toBeDisabled();
  });

  it('shows success state with warning Alert after valid submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordModal {...DEFAULT_PROPS} />);

    await user.type(screen.getByLabelText(/nueva contraseña/i), 'validpassword123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'validpassword123');
    await user.click(screen.getByRole('button', { name: /resetear contraseña/i }));

    await screen.findByText(/contraseña reseteada/i);
    // The success state shows a warning Alert about not showing the password again
    await screen.findByText(/no se vuelve a mostrar/i);
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordModal {...DEFAULT_PROPS} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
