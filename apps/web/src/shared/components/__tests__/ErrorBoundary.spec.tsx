import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom({ message }: { message: string }): JSX.Element {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  // React logs caught errors to console.error; silence noise during the suite
  // but assert calls when relevant.
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeAll(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <p>safe content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('shows the recovery shell when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom message="kaboom" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
  });

  it('exposes Reintentar and Recargar buttons', () => {
    render(
      <ErrorBoundary>
        <Boom message="x" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
  });

  it('calls onError telemetry hook with the error', () => {
    const spy = vi.fn();
    render(
      <ErrorBoundary onError={spy}>
        <Boom message="telemetry" />
      </ErrorBoundary>,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]?.message).toBe('telemetry');
  });

  it('uses a custom fallback when supplied', () => {
    render(
      <ErrorBoundary fallback={<p data-testid="custom">custom UI</p>}>
        <Boom message="x" />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  it('Reintentar resets the error and re-renders children', () => {
    // The flag lives in module scope so we control exactly when the child
    // throws. Initial render: throws. Click Reintentar after flipping the
    // flag: child resolves cleanly.
    const state = { shouldThrow: true };
    function Maybe(): JSX.Element {
      if (state.shouldThrow) throw new Error('first');
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    state.shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('swallows errors thrown inside onError', () => {
    const noisy = vi.fn(() => {
      throw new Error('telemetry blew up');
    });
    expect(() =>
      render(
        <ErrorBoundary onError={noisy}>
          <Boom message="x" />
        </ErrorBoundary>,
      ),
    ).not.toThrow();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
