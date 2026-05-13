import React, { createContext, useContext, useState, useCallback } from 'react';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '123456789012345678';
const STORAGE_KEY = 'durak_auth';
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

export type AuthMethod = 'discord' | 'email';

export interface AuthUser {
  id: string; // discordId for Discord users, MongoDB _id for email users
  method: AuthMethod;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  email?: string;
  token?: string; // JWT for email users
}

interface AuthContextState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  loginWithDiscord: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => void;
  handleOAuthCallback: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextState>({
  user: null,
  isLoading: false,
  error: null,
  loginWithDiscord: () => {},
  loginWithEmail: async () => {},
  register: async () => {},
  logout: () => {},
  handleOAuthCallback: async () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

function buildAvatarUrl(id: string, hash: string | null): string {
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(id || '0') % 5}.png`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as AuthUser;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = (u: AuthUser | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
  };

  const loginWithDiscord = useCallback(() => {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'identify',
    });
    window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
  }, []);

  const handleOAuthCallback = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const tokenRes = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
      });
      if (!tokenRes.ok) throw new Error('Token exchange failed');
      const { access_token } = await tokenRes.json();

      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!meRes.ok) throw new Error('Failed to fetch Discord user');
      const me = await meRes.json();

      persist({
        id: me.id,
        method: 'discord',
        username: me.username,
        globalName: me.global_name ?? null,
        avatarUrl: buildAvatarUrl(me.id, me.avatar),
        token: access_token,
      });

      window.history.replaceState({}, '', window.location.pathname);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Discord login failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      persist({
        id: data.user.id,
        method: 'email',
        username: data.user.username,
        globalName: null,
        avatarUrl: data.user.avatarUrl || '',
        email: data.user.email,
        token: data.token,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, username: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      persist({
        id: data.user.id,
        method: 'email',
        username: data.user.username,
        globalName: null,
        avatarUrl: data.user.avatarUrl || '',
        email: data.user.email,
        token: data.token,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    persist(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginWithDiscord,
        loginWithEmail,
        register,
        logout,
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
