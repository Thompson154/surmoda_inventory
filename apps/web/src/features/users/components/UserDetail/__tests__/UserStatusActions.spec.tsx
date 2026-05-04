import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserStatusActions } from '../UserStatusActions';
import type { User } from '@/features/users/types';

vi.mock('@/features/users/hooks/useUsers', () => ({
  useDeactivateUser: () => ({ mutate: mockDeactivate, isPending: false, error: null }),
  useReactivateUser: () => ({ mutate: mockReactivate, isPending: false, error: null }),
}));

const mockDeactivate = vi.fn();
const mockReactivate = vi.fn();

const activeUser: User = {
  id: 'u1',
  email: 'u@test.com',
  fullName: 'Usuario',
  isAdmin: false,
  isActive: true,
  assignments: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};
const inactiveUser: User = {
  ...activeUser,
  isActive: false,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('UserStatusActions — ConfirmDialog', () => {
  it('clicking Desactivar opens a ConfirmDialog with danger variant', () => {
    render(<UserStatusActions user={activeUser} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    // ConfirmDialog renders as alertdialog
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    // danger variant — confirm button matches confirmLabel
    expect(screen.getByText('Desactivar usuario')).toBeInTheDocument();
  });

  it('deactivate dialog has a reason textarea', () => {
    render(<UserStatusActions user={activeUser} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    expect(screen.getByLabelText(/motivo/i)).toBeInTheDocument();
  });

  it('confirming deactivate (with reason) calls mutate', async () => {
    mockDeactivate.mockClear();
    render(<UserStatusActions user={activeUser} />, { wrapper });
    // first Desactivar button (the trigger); dialog also has one
    const triggerButtons = screen.getAllByRole('button', { name: /desactivar/i });
    fireEvent.click(triggerButtons[0]!);
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'se fue' } });
    // after dialog opens, click the confirm button inside dialog
    const allButtons = screen.getAllByRole('button', { name: /desactivar/i });
    // last button is the confirm button inside the dialog
    fireEvent.click(allButtons[allButtons.length - 1]!);
    await waitFor(() => expect(mockDeactivate).toHaveBeenCalled());
  });

  it('cancelling deactivate dialog does not call mutate', () => {
    mockDeactivate.mockClear();
    render(<UserStatusActions user={activeUser} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    fireEvent.click(screen.getByText('Cancelar'));
    expect(mockDeactivate).not.toHaveBeenCalled();
  });

  it('clicking Reactivar opens ConfirmDialog (no reason needed)', () => {
    render(<UserStatusActions user={inactiveUser} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /reactivar/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByLabelText(/motivo/i)).not.toBeInTheDocument();
  });
});
