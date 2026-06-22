import React from 'react';
import '../App.css'; // Just re-using the exist App.css or creating new component styles
import { colors, gradients, radii, shadows, fonts } from '../theme';

export const LoadingScreen: React.FC<{ message?: string; isError?: boolean }> = ({
  message = 'Connecting to Server...',
  isError = false,
}) => {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: gradients.felt, color: colors.ivory[100], fontFamily: fonts.body }}
    >
      <div
        className="flex flex-col items-center gap-6"
        role="status"
        aria-live="polite"
        aria-label={isError ? message : 'Loading game...'}
      >
        {!isError && (
          <div
            className="w-16 h-16 rounded-full animate-spin"
            style={{
              border: `4px solid ${colors.felt[700]}`,
              borderTopColor: colors.gold[500],
            }}
            aria-hidden="true"
          ></div>
        )}
        <h2
          className={`text-2xl font-bold ${isError ? 'text-red-500' : ''}`}
          style={{
            fontFamily: fonts.display,
            letterSpacing: 1,
            color: isError ? undefined : colors.ivory[100],
            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
          }}
        >
          {message}
        </h2>
        {isError && (
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '12px 24px',
              borderRadius: radii.md,
              background: gradients.gold,
              color: colors.ink[900],
              border: '1.5px solid rgba(212,175,55,0.7)',
              boxShadow: `${shadows.mid}, ${shadows.engrave}, ${shadows.goldGlow}`,
              fontFamily: fonts.body,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              cursor: 'pointer',
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
};
