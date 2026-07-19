import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { colors, shadows, fonts, gradients } from '../theme';
import {
  isAppleAvailable,
  isGoogleAvailable,
  renderGoogleButton,
  signInWithApple,
} from '../utils/socialAuth';
import { useIsDesktop } from '../utils/useIsDesktop';

// ── Mongolian Knot Corner Decoration ──────────────────────────────────────────
export const MongolianKnot: React.FC<{ size?: number; color?: string; className?: string }> = ({
  size = 24,
  color = '#d4af37',
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    stroke={color}
    strokeWidth="6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
  >
    <path d="M 50 15 L 85 50 L 50 85 L 15 50 Z" />
    <path d="M 32.5 32.5 L 67.5 67.5" />
    <path d="M 67.5 32.5 L 32.5 67.5" />
    <circle cx="50" cy="50" r="12" fill="#2a0a0a" stroke={color} strokeWidth="5" />
  </svg>
);

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="#d4af37"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5 opacity-80"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="#d4af37"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5 opacity-80"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5 opacity-60 hover:opacity-100 transition-opacity"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5 opacity-60 hover:opacity-100 transition-opacity"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12 6.033 12 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.745-.078-1.32-.176-1.886H12.24z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const AppleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M16.365 1.43c0 1.14-.42 2.21-1.12 3.01-.84.95-2.21 1.69-3.39 1.6-.14-1.12.42-2.3 1.07-3.02.79-.89 2.24-1.56 3.44-1.59zM20.5 17.2c-.6 1.38-.88 1.99-1.65 3.21-1.08 1.7-2.6 3.82-4.48 3.84-1.67.02-2.1-1.09-4.37-1.08-2.27.01-2.74 1.1-4.41 1.08-1.88-.02-3.32-1.93-4.4-3.63C-1.3 15.66-1.95 9.34.58 6.06c1.13-1.49 2.91-2.43 4.59-2.43 1.71 0 2.78 1.09 4.19 1.09 1.37 0 2.2-1.09 4.18-1.09 1.49 0 3.07.81 4.2 2.21-3.69 2.02-3.09 7.29.76 8.36-.18.54-.34 1-.5 1z" />
  </svg>
);

type Tab = 'login' | 'register';

interface LoginPanelProps {
  inline?: boolean;
}

export const LoginPanel: React.FC<LoginPanelProps> = ({ inline = false }) => {
  const {
    user,
    isLoading,
    error,
    loginWithDiscord,
    loginWithEmail,
    loginWithGoogle,
    loginWithApple,
    register,
    logout,
  } = useAuth();
  const { t } = useTranslation('home');
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const showGoogle = isGoogleAvailable();
  const showApple = isAppleAvailable();

  useEffect(() => {
    if (!showGoogle || user || !googleBtnRef.current) return;
    void renderGoogleButton(googleBtnRef.current, (credential) => {
      void loginWithGoogle(credential).catch(() => {});
    });
  }, [showGoogle, user, loginWithGoogle]);

  const handleAppleSignIn = async () => {
    setLocalError(null);
    try {
      const result = await signInWithApple();
      await loginWithApple(result);
    } catch {
      // handled
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else {
        if (!username.trim()) {
          setLocalError(t('login.usernameRequired'));
          return;
        }
        if (password.length < 8) {
          setLocalError(t('login.passwordMinLength'));
          return;
        }
        await register(email, password, username);
      }
    } catch {
      // handled
    }
  };

  // ── Logged In Status Banner ────────────────────────────────────────────────
  if (user) {
    return (
      <div
        className="w-full flex items-center justify-between gap-4 p-5 rounded-2xl border animate-fade-in"
        style={{
          background: 'linear-gradient(180deg, rgba(42,10,10,0.85), rgba(20,5,5,0.95))',
          borderColor: 'rgba(212,175,55,0.3)',
          boxShadow: `${shadows.mid}, ${shadows.goldEdge}`,
        }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-11 h-11 rounded-full border-2 object-cover shrink-0"
              style={{ borderColor: colors.gold[500], boxShadow: shadows.goldGlow }}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full border-2 flex items-center justify-center font-black shrink-0"
              style={{
                background: gradients.velvet,
                borderColor: colors.gold[500],
                color: colors.ivory[100],
                boxShadow: shadows.goldGlow,
              }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div
              className="font-bold truncate font-display"
              style={{
                color: colors.ivory[100],
                fontSize: 16,
                letterSpacing: 0.5,
              }}
            >
              {user.globalName || user.username}
            </div>
            <div
              style={{
                color: colors.gold[400],
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginTop: 1,
              }}
            >
              {t('login.account', { name: user.method })}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer rounded-lg border-none hover:bg-black/20"
          style={{
            background: 'transparent',
            color: colors.gold[400],
            fontFamily: fonts.body,
          }}
        >
          {t('login.logOut')}
        </button>
      </div>
    );
  }

  const displayError = localError || error;

  // ── Render Compact Form (Used in inline layout and split right panel) ───────
  const renderFormContent = () => (
    <div className="w-full flex flex-col justify-center px-4 md:px-12 py-8">
      {/* Title */}
      <h2
        className="text-2xl font-black text-center font-display mb-1 tracking-wider"
        style={{
          backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 45%, #8b6914 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        {tab === 'login' ? 'Log In to Your Account' : 'Create an Account'}
      </h2>
      <div className="w-24 h-px self-center bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.5)] to-transparent mb-6" />

      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
        {tab === 'register' && (
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10">
              <UserIcon />
            </span>
            <input
              type="text"
              placeholder={t('login.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={32}
              required
              className="w-full pl-11 pr-4 py-3 rounded-xl border outline-none text-sm transition-all placeholder:opacity-50"
              style={{
                background: 'rgba(0,0,0,0.45)',
                borderColor: 'rgba(212,175,55,0.25)',
                color: colors.ivory[100],
                fontFamily: fonts.body,
                boxShadow: shadows.engrave,
              }}
            />
          </div>
        )}

        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10">
            <UserIcon />
          </span>
          <input
            type="email"
            placeholder="Username / Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-11 pr-4 py-3 rounded-xl border outline-none text-sm transition-all placeholder:opacity-50"
            style={{
              background: 'rgba(0,0,0,0.45)',
              borderColor: 'rgba(212,175,55,0.25)',
              color: colors.ivory[100],
              fontFamily: fonts.body,
              boxShadow: shadows.engrave,
            }}
          />
        </div>

        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10">
            <LockIcon />
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder={t('login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full pl-11 pr-11 py-3 rounded-xl border outline-none text-sm transition-all placeholder:opacity-50"
            style={{
              background: 'rgba(0,0,0,0.45)',
              borderColor: 'rgba(212,175,55,0.25)',
              color: colors.ivory[100],
              fontFamily: fonts.body,
              boxShadow: shadows.engrave,
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 cursor-pointer p-1"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* Row: Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-xs font-semibold px-1">
          <label className="flex items-center gap-2 cursor-pointer text-[rgba(216,200,156,0.85)] hover:text-white">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4.5 h-4.5 accent-[#d4af37] cursor-pointer rounded bg-black/40 border-[rgba(212,175,55,0.3)]"
            />
            Remember Me
          </label>
          <a
            href="#forgot"
            onClick={(e) => {
              e.preventDefault();
              alert('Password reset is under construction.');
            }}
            className="hover:underline transition text-[#d4af37]"
          >
            Forgot Password?
          </a>
        </div>

        {displayError && (
          <p className="text-red-400 text-xs font-semibold text-center m-0">{displayError}</p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full py-3 mt-2 rounded-xl text-sm font-extrabold uppercase tracking-widest border transition duration-150 cursor-pointer hover:brightness-110 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: gradients.gold,
            color: colors.ink[900],
            borderColor: 'rgba(212,175,55,0.6)',
            fontFamily: fonts.body,
            boxShadow: `0 4px 14px rgba(212,175,55,0.3), ${shadows.engrave}`,
          }}
        >
          {isLoading ? t('common:status.loading') : tab === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[rgba(212,175,55,0.22)]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(216,200,156,0.6)]">
          Or log in with...
        </span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[rgba(212,175,55,0.22)]" />
      </div>

      {/* Social Buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Google */}
        {showGoogle ? (
          <div
            ref={googleBtnRef}
            className="relative w-10 h-10 overflow-hidden rounded-full border border-[rgba(212,175,55,0.3)] bg-[#1a1308] hover:bg-black/35 flex items-center justify-center transition"
          />
        ) : (
          <button
            onClick={() => loginWithGoogle('mock')}
            className="w-10 h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-white hover:bg-zinc-100 text-black flex items-center justify-center cursor-pointer transition shadow"
            title="Sign in with Google"
          >
            <GoogleIcon />
          </button>
        )}

        {/* Facebook */}
        <button
          onClick={() => alert('Facebook login is under construction.')}
          className="w-10 h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#1877F2] hover:bg-[#166fe5] text-white flex items-center justify-center cursor-pointer transition shadow"
          title="Sign in with Facebook"
        >
          <FacebookIcon />
        </button>

        {/* Discord */}
        <button
          onClick={loginWithDiscord}
          disabled={isLoading}
          title="Sign in with Discord"
          className="w-10 h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#5865F2] hover:bg-[#4752c4] text-white flex items-center justify-center cursor-pointer transition"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </button>

        {/* Apple */}
        {showApple ? (
          <button
            onClick={handleAppleSignIn}
            disabled={isLoading}
            title="Sign in with Apple"
            className="w-10 h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-black hover:bg-zinc-900 text-white flex items-center justify-center cursor-pointer transition"
          >
            <AppleLogo />
          </button>
        ) : (
          <button
            onClick={() => loginWithApple({ identityToken: 'mock' })}
            className="w-10 h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-black hover:bg-zinc-900 text-white flex items-center justify-center cursor-pointer transition shadow"
            title="Sign in with Apple"
          >
            <AppleLogo />
          </button>
        )}
      </div>

      {/* Switch Link */}
      <p className="text-center text-xs font-semibold mt-8 text-[rgba(216,200,156,0.7)]">
        {tab === 'login' ? (
          <>
            Not a member?{' '}
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setLocalError(null);
              }}
              className="bg-transparent border-none text-[#d4af37] font-bold hover:underline cursor-pointer"
            >
              Sign Up
            </button>
          </>
        ) : (
          <>
            Already a member?{' '}
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setLocalError(null);
              }}
              className="bg-transparent border-none text-[#d4af37] font-bold hover:underline cursor-pointer"
            >
              Log In
            </button>
          </>
        )}
      </p>
    </div>
  );

  // ── Inline rendering (Embedded inside Sheets or small widgets) ──────────────
  if (inline) {
    return (
      <div
        className="w-full max-w-md mx-auto rounded-2xl border backdrop-blur-md"
        style={{
          background: 'linear-gradient(180deg, rgba(20,5,5,0.85), rgba(10,2,2,0.95))',
          borderColor: 'rgba(212,175,55,0.22)',
          boxShadow: `${shadows.mid}, ${shadows.goldEdge}`,
        }}
      >
        {renderFormContent()}
      </div>
    );
  }

  // ── Full-Page Layout (Split Desktop / Column Mobile) ────────────────────────
  return (
    <div
      className="min-h-[85vh] flex flex-col items-center justify-center p-3 md:p-8"
      style={{
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Outer container with Mongolian corner knots */}
      <div
        className="relative w-full max-w-5xl rounded-3xl border overflow-hidden flex flex-col md:flex-row"
        style={{
          background: 'linear-gradient(180deg, rgba(42,10,10,0.98) 0%, rgba(20,5,5,0.99) 100%)',
          borderColor: 'rgba(212,175,55,0.38)',
          boxShadow: `0 32px 80px rgba(0,0,0,0.8), ${shadows.goldEdge}`,
        }}
      >
        {/* Mongolian Knot Border Decorations at the outer frame corners */}
        <div className="absolute left-3 top-3 z-30 pointer-events-none">
          <MongolianKnot size={24} />
        </div>
        <div className="absolute right-3 top-3 z-30 pointer-events-none">
          <MongolianKnot size={24} />
        </div>
        <div className="absolute left-3 bottom-3 z-30 pointer-events-none">
          <MongolianKnot size={24} />
        </div>
        <div className="absolute right-3 bottom-3 z-30 pointer-events-none">
          <MongolianKnot size={24} />
        </div>

        {/* ── Left Side (Desktop: Illustration / Mobile: Character Circle) ───── */}
        {isDesktop ? (
          // DESKTOP: Yurt card-playing illustration
          <div
            className="w-1/2 relative bg-cover bg-center border-r select-none min-h-[580px]"
            style={{
              backgroundImage: 'url("/assets/home_illustration.png")',
              borderColor: 'rgba(212,175,55,0.22)',
            }}
          >
            {/* Dark tint overlay */}
            <div className="absolute inset-0 bg-black/35 bg-gradient-to-t from-black/85 via-black/30 to-black/75" />

            {/* Muushig logo overlay inside the illustration */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <img
                src="/assets/logo.png"
                alt="Muushig Logo"
                className="w-32 h-32 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] animate-pulse"
                style={{ animationDuration: '4s' }}
              />
              <h1
                className="text-4xl font-black mt-4 font-display uppercase tracking-widest leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
                style={{
                  backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 45%, #fce28a 90%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                MUUSHIG
              </h1>
              <p
                className="text-sm font-bold tracking-widest text-[#d4af37] font-display drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] mt-1.5"
                style={{ opacity: 0.95 }}
              >
                МҮҮШИГ
              </p>
            </div>
          </div>
        ) : (
          // MOBILE: Top header with boy cartoon avatar & banner
          <div className="w-full flex flex-col items-center pt-8 pb-2 px-6 text-center select-none">
            {/* Header branding logo and name */}
            <div className="flex items-center justify-center gap-2.5 mb-6">
              <img
                src="/assets/logo.png"
                alt="Muushig Logo"
                className="w-10 h-10 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              />
              <div>
                <h1
                  className="text-xl font-black font-display uppercase tracking-wider leading-none"
                  style={{
                    backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 55%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  MUUSHIG
                </h1>
                <p className="text-[10px] font-bold tracking-widest text-[#d4af37] text-left mt-0.5 opacity-90">
                  МҮҮШИГ
                </p>
              </div>
            </div>

            {/* Traditional cartoon boy avatar character in circle */}
            <div className="relative mb-4 mt-2">
              <div
                className="absolute inset-0 rounded-full blur-xl"
                style={{
                  background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, transparent 70%)',
                }}
              />
              <div
                className="relative w-28 h-28 rounded-full border-3 overflow-hidden shadow-2xl"
                style={{
                  borderColor: '#d4af37',
                  background: 'linear-gradient(180deg, #2a0a0a, #5b1818)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 2px 10px rgba(0,0,0,0.7)',
                }}
              >
                <img
                  src="/assets/mongolian_boy.png"
                  alt="Mongolian player cartoon character"
                  className="w-full h-full object-cover scale-105"
                />
              </div>
            </div>

            <h2
              className="text-lg font-bold font-display text-[rgba(216,200,156,0.9)] tracking-wider mt-1"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
            >
              Welcome back, player!
            </h2>
          </div>
        )}

        {/* ── Right Side (Form Area) ─────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center">{renderFormContent()}</div>
      </div>
    </div>
  );
};
