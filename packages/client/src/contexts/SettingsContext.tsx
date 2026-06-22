import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import i18n from '../i18n/index';

export interface GameSettings {
  soundEffects: boolean;
  animations: boolean;
  showTimer: boolean;
  confirmLeave: boolean;
  language: 'en' | 'mn';
}

const DEFAULTS: GameSettings = {
  soundEffects: true,
  animations: true,
  showTimer: true,
  confirmLeave: true,
  language: 'en',
};

const LS_KEY = 'durak_settings';

function fromStorage(): GameSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore malformed stored settings */
  }
  return DEFAULTS;
}

interface SettingsCtx {
  settings: GameSettings;
  updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsCtx>({
  settings: DEFAULTS,
  updateSetting: () => {},
  isLoading: false,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<GameSettings>(() => {
    const s = fromStorage();
    void i18n.changeLanguage(s.language);
    return s;
  });
  const [isLoading, setIsLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<GameSettings>>({});

  // Fetch from DB whenever the user changes (login/logout)
  useEffect(() => {
    if (!user?.token) {
      const s = fromStorage();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(s);
      void i18n.changeLanguage(s.language);
      return;
    }
    setIsLoading(true);
    fetch('/api/settings', { headers: { Authorization: `Bearer ${user.token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const merged = { ...DEFAULTS, ...data };
          setSettings(merged);
          localStorage.setItem(LS_KEY, JSON.stringify(merged));
          void i18n.changeLanguage(merged.language ?? 'en');
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user?.token]);

  // Debounced DB save — batches rapid toggles into one PATCH
  const flushToDb = useCallback((patch: Partial<GameSettings>, token: string) => {
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  const updateSetting = useCallback(
    <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        localStorage.setItem(LS_KEY, JSON.stringify(next));
        return next;
      });

      if (key === 'language') {
        void i18n.changeLanguage(value as string);
      }

      if (user?.token) {
        pendingRef.current = { ...pendingRef.current, [key]: value };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          flushToDb(pendingRef.current, user.token!);
          pendingRef.current = {};
        }, 600);
      }
    },
    [user, flushToDb],
  );

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};
