// Tests for <ReportGeneratorModal> (TAREA 7 — component tests).

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportGeneratorModal } from '../ReportGeneratorModal';
import { renderWithProviders } from '@/test/utils';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import type { AuthUser } from '@/features/auth/stores/useAuthStore';

const fakeAdmin: AuthUser = {
  id: 'admin-1',
  email: 'admin@demo.local',
  fullName: 'Admin Demo',
  isAdmin: true,
  assignments: [],
};

function openModal(onClose = vi.fn(), onPreviewReady = vi.fn()) {
  useAuthStore.setState({ user: fakeAdmin, accessToken: 'fake-token' });
  return renderWithProviders(
    <ReportGeneratorModal
      isOpen
      onClose={onClose}
      storeId="store-prado-seed"
      storeName="Sucursal Prado"
      onPreviewReady={onPreviewReady}
    />,
  );
}

describe('ReportGeneratorModal', () => {
  it('renders the modal title and store subtitle', () => {
    openModal();
    expect(screen.getByText('Generar Reporte de Ventas')).toBeInTheDocument();
    // Text is split across elements: "Sucursal: " + "Sucursal Prado"
    expect(screen.getByText('Sucursal Prado')).toBeInTheDocument();
  });

  it('renders date range presets', () => {
    openModal();
    expect(screen.getByRole('button', { name: /Hoy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /7 días/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 mes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Personalizado/i })).toBeInTheDocument();
  });

  it('shows date inputs when Personalizado is selected', () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: /Personalizado/i }));
    // Date inputs should be editable
    const fromInput = screen.getByLabelText(/desde/i);
    const toInput = screen.getByLabelText(/hasta/i);
    expect(fromInput).not.toBeDisabled();
    expect(toInput).not.toBeDisabled();
  });

  it('shows validation error when date range exceeds 12 months', async () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: /Personalizado/i }));

    const fromInput = screen.getByLabelText(/desde/i);
    const toInput = screen.getByLabelText(/hasta/i);

    fireEvent.change(fromInput, { target: { value: '2024-01-01' } });
    fireEvent.change(toInput, { target: { value: '2026-01-02' } }); // > 12 months

    fireEvent.click(screen.getByRole('button', { name: /Generar vista previa/i }));

    await waitFor(() => {
      expect(screen.getByText(/12 meses/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancelar is clicked', () => {
    const onClose = vi.fn();
    openModal(onClose);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders option toggles for payment summary and inventory', () => {
    openModal();
    expect(screen.getByText(/Incluir resumen por método de pago/i)).toBeInTheDocument();
    expect(screen.getByText(/Incluir inventario actual/i)).toBeInTheDocument();
  });
});
