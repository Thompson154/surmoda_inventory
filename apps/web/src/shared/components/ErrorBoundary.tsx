// Top-level React error boundary. Catches render-phase and lifecycle errors
// anywhere below it, prevents the white-screen-of-death, and gives the user
// an explicit recovery path.
//
// Why class component: error boundaries require `componentDidCatch` /
// `getDerivedStateFromError`, neither of which has a hook equivalent in
// React 18. This is the canonical implementation.
//
// Telemetry: `onError` is exposed so callers can pipe to Sentry, GlitchTip,
// or any other APM the app wires later (Tier 1 — currently unused).
//
// ErrorBoundaryWithReset: functional wrapper that resets the boundary on
// route change by passing `location.key` as `key`. Requires React Router
// context — use it INSIDE <BrowserRouter>.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
  /** Optional override for the fallback UI. */
  fallback?: ReactNode;
  /** Telemetry hook. Called on every catch. Failures inside it are swallowed. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Always log to the console so dev sees the trace immediately.
    console.error('[ErrorBoundary]', error, info.componentStack);
    if (this.props.onError) {
      try {
        this.props.onError(error, info);
      } catch {
        // Telemetry failure must never mask the original error.
      }
    }
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div
        role="alert"
        className="min-h-[100dvh] flex items-center justify-center bg-surface-base p-6"
      >
        <div className="max-w-md w-full rounded-xl border border-surface-border bg-surface-raised p-6 shadow-sm flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Algo salió mal</h1>
          <p className="text-sm text-text-secondary">
            La aplicación encontró un error inesperado. Probá recargar la página o volver al inicio.
            Si el problema persiste, avisale al admin.
          </p>
          {/* Tier 3.C.9 — error.message can leak internal function names,
              line numbers, or API shape that's useful for an attacker.
              Show it only in dev (vite.import.meta.env.DEV); in prod the
              user gets the friendly Spanish copy above and the actual
              error goes to the APM via the onError telemetry hook. */}
          {import.meta.env.DEV && (
            <p className="text-[11px] font-mono text-text-subtle break-words">{error.message}</p>
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md bg-brand-primary text-white text-sm font-semibold px-3 py-2 hover:bg-brand-primary-hover"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-surface-border text-text-secondary text-sm font-semibold px-3 py-2 hover:bg-surface-sunken"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Route-aware wrapper for ErrorBoundary.
 *
 * Passes `location.key` as the React `key` prop so that whenever the user
 * navigates to a different route, React unmounts and remounts the boundary
 * — clearing any stale error fallback automatically.
 *
 * REQUIREMENT: must be rendered inside a React Router context
 * (i.e. inside <BrowserRouter> or equivalent).
 */
export function ErrorBoundaryWithReset(props: Props) {
  const location = useLocation();
  return <ErrorBoundary key={location.key} {...props} />;
}
