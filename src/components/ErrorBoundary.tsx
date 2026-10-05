import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep error logging clean and safe
    console.error('App error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mx-auto text-[var(--accent)]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="text-sm text-[var(--muted)]">
                The application encountered an unexpected issue. Your saved conversations and keys are safe.
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-md hover:opacity-90 transition cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
