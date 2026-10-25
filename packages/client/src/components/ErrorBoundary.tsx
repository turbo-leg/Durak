import React from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="recovery-screen">
          <div className="recovery-content">
            <span className="recovery-suit" aria-hidden="true">
              ♠
            </span>
            <p className="recovery-brand">durak</p>
            <h1>The table needs a reset.</h1>
            <p>
              Reload to return to your seat. If your game is still running, we’ll try to reconnect
              you.
            </p>
            <button onClick={() => location.reload()}>Reload table</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
