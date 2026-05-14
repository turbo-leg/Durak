import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const DiscordLogo = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" aria-hidden>
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

type Tab = 'login' | 'register';

export const LoginPanel: React.FC = () => {
  const { user, isLoading, error, loginWithDiscord, loginWithEmail, register, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (user) {
    return (
      <div className="bg-indigo-950 border border-indigo-700 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-9 h-9 rounded-full border-2 border-indigo-400 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center font-bold text-sm border-2 border-indigo-400 shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold text-sm text-white truncate">
              {user.globalName || user.username}
            </div>
            <div className="text-indigo-400 text-xs capitalize">{user.method} account</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-indigo-400 hover:text-white text-xs px-2 py-1 rounded border border-indigo-700 hover:border-indigo-500 transition shrink-0"
        >
          Log out
        </button>
      </div>
    );
  }

  const displayError = localError || error;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else {
        if (!username.trim()) {
          setLocalError('Username is required');
          return;
        }
        if (password.length < 8) {
          setLocalError('Password must be at least 8 characters');
          return;
        }
        await register(email, password, username);
      }
    } catch {
      // error already set in context
    }
  };

  return (
    <div className="bg-indigo-950 border border-indigo-700 rounded-xl p-5">
      <div className="text-white font-bold mb-3">Your Account</div>

      {/* Auth method tabs */}
      <div className="flex gap-2 mb-4">
        {(['login', 'register'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setLocalError(null);
            }}
            className={`px-3 py-1 rounded text-xs font-semibold capitalize transition ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-900 text-indigo-300 hover:bg-indigo-800'
            }`}
          >
            {t === 'login' ? 'Log In' : 'Register'}
          </button>
        ))}
      </div>

      {/* Discord button */}
      <button
        onClick={loginWithDiscord}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition mb-3"
      >
        <DiscordLogo />
        Continue with Discord
      </button>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-indigo-800" />
        <span className="text-indigo-500 text-xs">or</span>
        <div className="flex-1 h-px bg-indigo-800" />
      </div>

      {/* Email/password form */}
      <form onSubmit={handleEmailSubmit} className="space-y-2">
        {tab === 'register' && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-indigo-900 border border-indigo-700 text-white placeholder-indigo-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            maxLength={32}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-indigo-900 border border-indigo-700 text-white placeholder-indigo-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-indigo-900 border border-indigo-700 text-white placeholder-indigo-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
        />

        {displayError && <p className="text-red-400 text-xs">{displayError}</p>}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition"
        >
          {isLoading ? 'Loading…' : tab === 'login' ? 'Log In' : 'Create Account'}
        </button>
      </form>

      <p className="text-indigo-500 text-xs mt-3 text-center">
        Guests can play without an account — login is optional.
      </p>
    </div>
  );
};
