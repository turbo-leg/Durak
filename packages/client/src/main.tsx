import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { GameProvider } from './contexts/GameContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { CardBackProvider } from './contexts/CardBackContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CardBackProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </CardBackProvider>
    </AuthProvider>
  </StrictMode>,
);
