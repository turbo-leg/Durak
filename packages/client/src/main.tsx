import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App.tsx';
import { GameProvider } from './contexts/GameContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
});

const FallbackComponent = () => (
  <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white p-8 text-center">
    <div>
      <div className="text-4xl mb-4">♠</div>
      <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
      <p className="text-indigo-400 mb-4">The game crashed. Your progress is saved.</p>
      <button
        onClick={() => window.location.reload()}
        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded font-semibold"
      >
        Restart
      </button>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={FallbackComponent}>
      <AuthProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
