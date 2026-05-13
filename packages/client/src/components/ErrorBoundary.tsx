import React from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Sentry is optional — only report if configured
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6">
          <div className="bg-indigo-900 border border-indigo-700 rounded-xl p-8 max-w-md text-center text-white">
            <div className="text-5xl mb-4">🃏</div>
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-indigo-300 text-sm mb-6">The game ran into an unexpected error.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-semibold transition"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
