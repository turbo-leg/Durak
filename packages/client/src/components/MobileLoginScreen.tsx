import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register';

export const MobileLoginScreen: React.FC = () => {
  const { isLoading, error, loginWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      if (mode === 'login') {
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
        await registerWithEmail(email, password, username);
      }
    } catch {
      // error already set in context
    }
  };

  const handleGuest = async () => {
    setLocalError(null);
    const guestUsername = `guest_${Math.random().toString(36).slice(2, 9)}`;
    const guestEmail = `${guestUsername}@guest.durak.local`;
    const guestPassword = crypto.randomUUID();
    try {
      await registerWithEmail(guestEmail, guestPassword, guestUsername);
    } catch {
      setLocalError('Could not create guest session. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-purple-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
            ♦ Durak <span className="text-yellow-400">Online</span> ♦
          </h1>
          <p className="text-purple-400 text-sm mt-2">Multiplayer card game</p>
        </div>

        {/* Card */}
        <div className="bg-purple-900/60 border border-purple-700 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
          {/* Mode tabs */}
          <div className="flex gap-2 mb-5">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setLocalError(null);
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  mode === m
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-purple-800/50 text-purple-300 hover:bg-purple-700/50'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-3"
            aria-label={mode === 'login' ? 'Sign in form' : 'Sign up form'}
          >
            {mode === 'register' && (
              <div>
                <label htmlFor="login-username" className="sr-only">
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-required="true"
                  aria-describedby={displayError ? 'login-error' : undefined}
                  className="w-full bg-purple-800/60 border border-purple-600 text-white placeholder-purple-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  maxLength={32}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            )}
            <div>
              <label htmlFor="login-email" className="sr-only">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-required="true"
                aria-describedby={displayError ? 'login-error' : undefined}
                className="w-full bg-purple-800/60 border border-purple-600 text-white placeholder-purple-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-required="true"
                aria-describedby={displayError ? 'login-error' : undefined}
                className="w-full bg-purple-800/60 border border-purple-600 text-white placeholder-purple-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>

            {displayError && (
              <p id="login-error" role="alert" className="text-red-400 text-xs px-1">
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-purple-950 font-bold py-3 rounded-xl transition shadow-lg"
            >
              {isLoading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-purple-700" />
            <span className="text-purple-500 text-xs">or</span>
            <div className="flex-1 h-px bg-purple-700" />
          </div>

          {/* Guest */}
          <button
            onClick={handleGuest}
            disabled={isLoading}
            className="w-full bg-purple-800/60 hover:bg-purple-700/60 disabled:opacity-50 text-purple-200 font-semibold py-3 rounded-xl border border-purple-600 transition"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};
