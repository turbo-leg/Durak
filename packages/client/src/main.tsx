import './i18n/index';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { GameProvider } from './contexts/GameContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { CardBackProvider } from './contexts/CardBackContext.tsx';
import { SettingsProvider } from './contexts/SettingsContext.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <CardBackProvider>
          <GameProvider>
            <Suspense fallback={<LoadingScreen />}>
              <App />
            </Suspense>
          </GameProvider>
        </CardBackProvider>
      </SettingsProvider>
    </AuthProvider>
  </StrictMode>,
);
