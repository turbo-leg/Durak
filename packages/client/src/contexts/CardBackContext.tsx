import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface CardBackContextState {
  imageUrl: string | null; // e.g. /assets/cardbacks/cardback_midnight.png
}

const CardBackContext = createContext<CardBackContextState>({ imageUrl: null });

// eslint-disable-next-line react-refresh/only-export-components
export const useCardBack = () => useContext(CardBackContext);

export const CardBackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImageUrl(null);
      return;
    }
    fetch('/api/shop/me', { headers: { Authorization: `Bearer ${user.token}` } })
      .then((r) => r.json())
      .then((data) => {
        const id: string = data?.equippedCardBack ?? '';
        setImageUrl(id ? `/assets/cardbacks/${id}.png` : null);
      })
      .catch(() => setImageUrl(null));
  }, [user?.token]);

  return <CardBackContext.Provider value={{ imageUrl }}>{children}</CardBackContext.Provider>;
};
