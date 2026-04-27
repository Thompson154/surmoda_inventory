import { describe, expect, it, vi } from 'vitest';
import { render, screen, act, fireEvent, renderHook } from '@testing-library/react';
import { ToastProvider, useToast } from '../toast';

function Harness({ onMount }: { onMount: (toast: ReturnType<typeof useToast>) => void }) {
  const toast = useToast();
  onMount(toast);
  return null;
}

describe('ToastProvider + useToast', () => {
  it('renders a success toast with the message and role=status', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onMount={(t) => (api = t)} />
      </ToastProvider>,
    );
    act(() => api!.success('Venta guardada'));
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Venta guardada');
  });

  it('renders an error toast with role=alert (assertive)', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onMount={(t) => (api = t)} />
      </ToastProvider>,
    );
    act(() => api!.error('Sin stock'));
    expect(screen.getByRole('alert')).toHaveTextContent('Sin stock');
  });

  it('auto-dismisses after 4 seconds', () => {
    vi.useFakeTimers();
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onMount={(t) => (api = t)} />
      </ToastProvider>,
    );
    act(() => api!.info('Hola'));
    expect(screen.getByRole('status')).toHaveTextContent('Hola');
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByRole('status')).toBeNull();
    vi.useRealTimers();
  });

  it('manual close via X button removes the toast immediately', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onMount={(t) => (api = t)} />
      </ToastProvider>,
    );
    act(() => api!.success('Bien'));
    fireEvent.click(screen.getByRole('button', { name: /cerrar notificación/i }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('queues multiple toasts simultaneously', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onMount={(t) => (api = t)} />
      </ToastProvider>,
    );
    act(() => {
      api!.success('uno');
      api!.error('dos');
      api!.info('tres');
    });
    expect(screen.getAllByText(/uno|dos|tres/)).toHaveLength(3);
  });

  it('throws when useToast is used outside the provider', () => {
    expect(() => renderHook(() => useToast())).toThrow(/inside <ToastProvider>/);
  });
});
