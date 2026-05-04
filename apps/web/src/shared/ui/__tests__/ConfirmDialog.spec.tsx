import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

// Minimal props that keep the dialog open.
const base = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: 'Confirmar acción',
};

describe('ConfirmDialog', () => {
  it('renders the title and optional description', () => {
    render(<ConfirmDialog {...base} description="Esta acción no se puede deshacer." />);
    expect(screen.getByText('Confirmar acción')).toBeInTheDocument();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();
  });

  it('shows default Spanish labels when none provided', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('calls onConfirm with no argument when requiresReason is false', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables confirm and cancel buttons when isPending=true', () => {
    render(<ConfirmDialog {...base} isPending />);
    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });

  describe('requiresReason=true', () => {
    it('shows a textarea with the reason label', () => {
      render(<ConfirmDialog {...base} requiresReason />);
      expect(screen.getByLabelText('Motivo')).toBeInTheDocument();
    });

    it('confirm is disabled while textarea is empty', () => {
      render(<ConfirmDialog {...base} requiresReason />);
      expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    });

    it('typing a valid reason enables confirm', async () => {
      render(<ConfirmDialog {...base} requiresReason />);
      const textarea = screen.getByLabelText('Motivo');
      await userEvent.type(textarea, 'rotura de producto');
      expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
    });

    it('calls onConfirm WITH the reason string when submitted', async () => {
      const onConfirm = vi.fn();
      render(<ConfirmDialog {...base} onConfirm={onConfirm} requiresReason />);
      const textarea = screen.getByLabelText('Motivo');
      await userEvent.type(textarea, 'producto roto');
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      expect(onConfirm).toHaveBeenCalledWith('producto roto');
    });

    it('whitespace-only is treated as empty (confirm stays disabled)', async () => {
      render(<ConfirmDialog {...base} requiresReason />);
      const textarea = screen.getByLabelText('Motivo');
      await userEvent.type(textarea, '   ');
      expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    });
  });

  it('variant="danger" adds data-variant="danger" to confirm button', () => {
    render(<ConfirmDialog {...base} variant="danger" />);
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmBtn).toHaveAttribute('data-variant', 'danger');
  });

  it('buttons remain disabled while onConfirm Promise resolves', async () => {
    let resolve: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        }),
    );
    render(<ConfirmDialog {...base} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    // While promise is pending both buttons are disabled.
    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    // Resolve promise → buttons re-enable (caller still has open=true).
    await waitFor(() => {
      resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
    });
  });

  it('pressing Enter in the textarea triggers onConfirm when reason is valid', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} requiresReason />);
    const textarea = screen.getByLabelText('Motivo');
    await userEvent.type(textarea, 'motivo valido');
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('motivo valido');
  });

  it('has role="alertdialog" and aria-modal="true"', () => {
    render(<ConfirmDialog {...base} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
