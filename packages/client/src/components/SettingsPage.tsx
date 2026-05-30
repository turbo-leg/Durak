import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { colors, gradients, shadows, radii, fonts } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import type { GameSettings } from '../contexts/SettingsContext';
import { GoldButton } from './ui';

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: gradients.panel,
        borderRadius: radii.md,
        border: '1px solid rgba(212,175,55,0.15)',
        boxShadow: shadows.engrave,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 0.5,
            color: colors.ivory[100],
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 11, color: colors.ivory[300], marginTop: 3, opacity: 0.75 }}>
            {sublabel}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          position: 'relative',
          width: 48,
          height: 26,
          borderRadius: 13,
          border: 'none',
          cursor: 'pointer',
          background: value
            ? 'linear-gradient(135deg, #d4af37, #8b6914)'
            : 'rgba(255,255,255,0.08)',
          boxShadow: value ? shadows.goldGlow : 'inset 0 1px 3px rgba(0,0,0,0.5)',
          transition: 'background 0.2s, box-shadow 0.2s',
          flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ x: value ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            position: 'absolute',
            top: 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: value ? colors.ivory[50] : 'rgba(200,180,140,0.5)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        />
      </button>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: fonts.display,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 3,
        textTransform: 'uppercase',
        color: colors.gold[500],
        marginTop: 8,
        marginBottom: 4,
        paddingLeft: 4,
      }}
    >
      {label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: gradients.panel,
        borderRadius: radii.md,
        border: '1px solid rgba(212,175,55,0.12)',
        boxShadow: shadows.engrave,
      }}
    >
      <span style={{ fontSize: 13, color: colors.ivory[200] }}>{label}</span>
      <span style={{ fontSize: 13, color: colors.ivory[300], opacity: 0.7 }}>{value}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export const SettingsPage: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { settings, updateSetting, isLoading } = useSettings();
  const { t } = useTranslation('settings');

  const toggle = <K extends keyof GameSettings>(key: K) =>
    updateSetting(key, !settings[key] as GameSettings[K]);

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 96, paddingTop: 20 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28, padding: '0 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 50,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6))',
            }}
          />
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div
            style={{
              width: 50,
              height: 1,
              background: 'linear-gradient(90deg, rgba(212,175,55,0.6), transparent)',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: 5,
            textTransform: 'uppercase',
            backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 45%, #8b6914 85%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {t('title')}
        </div>
        {isLoading && (
          <div
            style={{
              fontSize: 11,
              color: colors.ivory[300],
              letterSpacing: 2,
              marginTop: 6,
              opacity: 0.6,
            }}
          >
            {t('common:status.loading')}
          </div>
        )}
        {!isLoading && user && (
          <div
            style={{
              fontSize: 11,
              color: colors.gold[500],
              letterSpacing: 2,
              marginTop: 6,
              opacity: 0.7,
              fontStyle: 'italic',
            }}
          >
            {t('syncedAccount')}
          </div>
        )}
        {!isLoading && !user && (
          <div
            style={{
              fontSize: 11,
              color: colors.ivory[300],
              letterSpacing: 2,
              marginTop: 6,
              opacity: 0.55,
              fontStyle: 'italic',
            }}
          >
            {t('savedLocally')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
        {/* Language */}
        <SectionHead label={t('sections.language')} />
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 16px',
            background: gradients.panel,
            borderRadius: radii.md,
            border: '1px solid rgba(212,175,55,0.15)',
            boxShadow: shadows.engrave,
          }}
        >
          {(['en', 'mn'] as const).map((lang) => {
            const active = settings.language === lang;
            const label = lang === 'en' ? '🇬🇧 English' : '🇲🇳 Монгол';
            return (
              <button
                key={lang}
                onClick={() => updateSetting('language', lang)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: radii.sm,
                  fontFamily: fonts.body,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 0.3,
                  cursor: 'pointer',
                  border: active
                    ? '1.5px solid rgba(212,175,55,0.8)'
                    : '1px solid rgba(212,175,55,0.15)',
                  background: active ? 'rgba(212,175,55,0.12)' : 'rgba(0,0,0,0.25)',
                  color: active ? colors.gold[300] : colors.ivory[300],
                  boxShadow: active ? shadows.goldGlow : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Sound & Visual */}
        <SectionHead label={t('sections.soundVisual')} />
        <ToggleRow
          label={t('toggles.soundEffects')}
          sublabel={t('toggles.soundEffectsSub')}
          value={settings.soundEffects}
          onChange={() => toggle('soundEffects')}
        />
        <ToggleRow
          label={t('toggles.animations')}
          sublabel={t('toggles.animationsSub')}
          value={settings.animations}
          onChange={() => toggle('animations')}
        />

        {/* Gameplay */}
        <SectionHead label={t('sections.gameplay')} />
        <ToggleRow
          label={t('toggles.showTimer')}
          sublabel={t('toggles.showTimerSub')}
          value={settings.showTimer}
          onChange={() => toggle('showTimer')}
        />
        <ToggleRow
          label={t('toggles.confirmLeave')}
          sublabel={t('toggles.confirmLeaveSub')}
          value={settings.confirmLeave}
          onChange={() => toggle('confirmLeave')}
        />

        {/* Appearance */}
        <SectionHead label={t('sections.appearance')} />
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate?.('shop')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: gradients.panel,
            borderRadius: radii.md,
            border: '1px solid rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 0.5,
                color: colors.ivory[100],
              }}
            >
              {t('cardBack')}
            </div>
            <div style={{ fontSize: 11, color: colors.ivory[300], marginTop: 3, opacity: 0.75 }}>
              {t('cardBackSub')}
            </div>
          </div>
          <span style={{ color: colors.gold[400], fontSize: 20 }}>›</span>
        </motion.button>

        {/* Account */}
        {user && (
          <>
            <SectionHead label={t('sections.account')} />
            <InfoRow label={t('account.signedInAs')} value={user.globalName || user.username} />
            <InfoRow
              label={t('account.loginMethod')}
              value={user.method === 'discord' ? t('account.discord') : t('account.email')}
            />
            <div style={{ marginTop: 8 }}>
              <GoldButton variant="burgundy" block onClick={logout}>
                {t('common:actions.signOut')}
              </GoldButton>
            </div>
          </>
        )}

        {/* About */}
        <SectionHead label={t('sections.about')} />
        <InfoRow label={t('about.game')} value={t('about.gameName')} />
        <InfoRow label={t('about.version')} value={t('about.versionValue')} />
        <InfoRow label={t('about.engine')} value={t('about.engineValue')} />

        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: colors.ivory[300],
            opacity: 0.45,
            marginTop: 20,
            fontStyle: 'italic',
            letterSpacing: 1,
          }}
        >
          {t('footer')}
        </div>
      </div>
    </div>
  );
};
