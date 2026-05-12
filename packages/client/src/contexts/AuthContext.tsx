import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '123456789012345678';
const STORAGE_KEY = 'durak_discord_auth';
// Use current origin so it works in dev (5173) and prod alike
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

export interface DiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  accessToken: string;
}

interface AuthContextState {
  user: DiscordUser | null;
  isLoading: boolean;
  loginWithDiscord: () => void;
  logout: () => void;
  handleOAuthCallback: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextState>({
  user: null,
  isLoading: false,
  loginWithDiscord: () => {},
  logout: () => {},
  handleOAuthCallback: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function buildAvatarUrl(id: string, hash: string | null): string {
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(id || '0') % 5}.png`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Restore saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const persist = (u: DiscordUser | null) => {
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
    try {
      // Exchange code for access token via our server (keeps client secret server-side)
      const tokenRes = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
      });
      if (!tokenRes.ok) throw new Error('Token exchange failed');
      const { access_token } = await tokenRes.json();

      // Fetch Discord user info
      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!meRes.ok) throw new Error('Failed to fetch Discord user');
      const me = await meRes.json();

      persist({
        id: me.id,
        username: me.username,
        globalName: me.global_name ?? null,
        avatarUrl: buildAvatarUrl(me.id, me.avatar),
        accessToken: access_token,
      });

      // Remove OAuth params from URL without triggering a reload
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {
      console.error('Discord OAuth failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    persist(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, loginWithDiscord, logout, handleOAuthCallback }}
    >
      {children}
    </AuthContext.Provider>
  );
};
