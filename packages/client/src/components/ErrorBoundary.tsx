import React from 'react';
import * as Sentry from '@sentry/react';
import { colors, gradients, shadows, radii, fonts } from '../theme';

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
      const buttonBase: React.CSSProperties = {
        padding: '12px 24px',
        borderRadius: radii.md,
        fontFamily: fonts.body,
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
      };

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: gradients.felt,
            fontFamily: fonts.body,
          }}
        >
          <div
            style={{
              background: gradients.panel,
              border: '1px solid rgba(212,175,55,0.22)',
              borderRadius: radii.lg,
              boxShadow: `${shadows.deep}, ${shadows.engrave}`,
              backdropFilter: 'blur(10px)',
              padding: 36,
              maxWidth: 420,
              textAlign: 'center',
              color: colors.ivory[100],
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>🃏</div>
            <h1
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                fontWeight: 700,
                color: colors.gold[300],
                letterSpacing: 1,
                textTransform: 'uppercase',
                textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                margin: '0 0 8px',
              }}
            >
              Something went wrong
            </h1>
            <p style={{ color: colors.ivory[300], fontSize: 14, margin: '0 0 28px' }}>
              The game ran into an unexpected error.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{
                  ...buttonBase,
                  background: gradients.gold,
                  color: colors.ink[900],
                  border: '1.5px solid rgba(212,175,55,0.7)',
                  boxShadow: `${shadows.mid}, ${shadows.engrave}, ${shadows.goldGlow}`,
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                Try again
              </button>
              <a
                href="https://github.com/turbo-leg/Durak/issues"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...buttonBase,
                  background: 'rgba(212,175,55,0.06)',
                  color: colors.gold[300],
                  border: '1.5px solid rgba(212,175,55,0.35)',
                  boxShadow: shadows.engrave,
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
