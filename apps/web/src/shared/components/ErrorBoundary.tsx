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

import { Component, type ErrorInfo, type ReactNode } from 'react';

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
        className="min-h-screen flex items-center justify-center bg-surface-base p-6"
      >
        <div className="max-w-md w-full rounded-xl border border-surface-border bg-white p-6 shadow-sm flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Algo salió mal</h1>
          <p className="text-sm text-slate-600">
            La aplicación encontró un error inesperado. Probá recargar la página
            o volver al inicio. Si el problema persiste, avisale al admin.
          </p>
          <p className="text-[11px] font-mono text-slate-400 break-words">
            {error.message}
          </p>
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
              className="rounded-md border border-surface-border text-slate-700 text-sm font-semibold px-3 py-2 hover:bg-surface-sunken"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
