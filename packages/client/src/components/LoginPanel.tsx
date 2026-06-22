import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Panel, Pill, TextInput, GoldButton, Divider, SectionLabel } from './ui';
import { colors, radii, shadows, fonts } from '../theme';
import {
  isAppleAvailable,
  isGoogleAvailable,
  renderGoogleButton,
  signInWithApple,
} from '../utils/socialAuth';

const DiscordLogo = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" aria-hidden>
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const AppleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" aria-hidden>
    <path d="M16.365 1.43c0 1.14-.42 2.21-1.12 3.01-.84.95-2.21 1.69-3.39 1.6-.14-1.12.42-2.3 1.07-3.02.79-.89 2.24-1.56 3.44-1.59zM20.5 17.2c-.6 1.38-.88 1.99-1.65 3.21-1.08 1.7-2.6 3.82-4.48 3.84-1.67.02-2.1-1.09-4.37-1.08-2.27.01-2.74 1.1-4.41 1.08-1.88-.02-3.32-1.93-4.4-3.63C-1.3 15.66-1.95 9.34.58 6.06c1.13-1.49 2.91-2.43 4.59-2.43 1.71 0 2.78 1.09 4.19 1.09 1.37 0 2.2-1.09 4.18-1.09 1.49 0 3.07.81 4.2 2.21-3.69 2.02-3.09 7.29.76 8.36-.18.54-.34 1-.5 1z" />
  </svg>
);

type Tab = 'login' | 'register';

const DISCORD_BLURPLE = '#5865F2';

export const LoginPanel: React.FC = () => {
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
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const showGoogle = isGoogleAvailable();
  const showApple = isAppleAvailable();

  // Render Google's official button once its container is mounted.
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
      // error surfaced via context, or user cancelled
    }
  };

  if (user) {
    return (
      <Panel
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              width={40}
              height={40}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: `2px solid ${colors.gold[500]}`,
                flexShrink: 0,
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: colors.felt[600],
                border: `2px solid ${colors.gold[500]}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: colors.ivory[100],
                flexShrink: 0,
              }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                color: colors.ivory[100],
                fontSize: 15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.globalName || user.username}
            </div>
            <div style={{ color: colors.gold[400], fontSize: 12, textTransform: 'capitalize' }}>
              {t('login.account', { name: user.method })}
            </div>
          </div>
        </div>
        <GoldButton variant="ghost" size="sm" onClick={logout} style={{ flexShrink: 0 }}>
          {t('login.logOut')}
        </GoldButton>
      </Panel>
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
      // error already set in context
    }
  };

  return (
    <Panel>
      <SectionLabel>{t('login.yourAccount')}</SectionLabel>

      {/* Auth method tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['login', 'register'] as Tab[]).map((tabKey) => (
          <Pill
            key={tabKey}
            active={tab === tabKey}
            onClick={() => {
              setTab(tabKey);
              setLocalError(null);
            }}
          >
            {tabKey === 'login' ? t('login.logIn') : t('login.register')}
          </Pill>
        ))}
      </div>

      {/* Discord button — keeps Discord brand color by design */}
      <button
        onClick={loginWithDiscord}
        disabled={isLoading}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: DISCORD_BLURPLE,
          color: '#fff',
          fontWeight: 700,
          fontFamily: fonts.body,
          padding: '11px 16px',
          borderRadius: radii.md,
          border: 'none',
          boxShadow: shadows.low,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.55 : 1,
          marginBottom: 14,
          transition: 'opacity 0.15s',
        }}
      >
        <DiscordLogo />
        {t('login.continueDiscord')}
      </button>

      {/* Google — official GIS button renders into this container */}
      {showGoogle && (
        <div
          ref={googleBtnRef}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}
        />
      )}

      {/* Apple — web popup or native iOS Sign in with Apple */}
      {showApple && (
        <button
          onClick={handleAppleSignIn}
          disabled={isLoading}
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#000',
            color: '#fff',
            fontWeight: 700,
            fontFamily: fonts.body,
            padding: '11px 16px',
            borderRadius: radii.md,
            border: 'none',
            boxShadow: shadows.low,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.55 : 1,
            marginBottom: 14,
            transition: 'opacity 0.15s',
          }}
        >
          <AppleLogo />
          {t('login.continueApple')}
        </button>
      )}

      <Divider label={t('login.or')} />

      {/* Email/password form */}
      <form
        onSubmit={handleEmailSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}
      >
        {tab === 'register' && (
          <TextInput
            type="text"
            placeholder={t('login.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={32}
          />
        )}
        <TextInput
          type="email"
          placeholder={t('login.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          type="password"
          placeholder={t('login.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {displayError && (
          <p style={{ color: '#e98a8a', fontSize: 12, margin: 0 }}>{displayError}</p>
        )}

        <GoldButton type="submit" block disabled={isLoading || !email || !password}>
          {isLoading
            ? t('common:status.loading')
            : tab === 'login'
              ? t('login.logIn')
              : t('login.createAccount')}
        </GoldButton>
      </form>

      <p
        style={{
          color: colors.ivory[300],
          fontSize: 12,
          marginTop: 14,
          marginBottom: 0,
          textAlign: 'center',
        }}
      >
        {t('login.guestNote')}
      </p>
    </Panel>
  );
};
