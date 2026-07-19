import React from 'react';
import { colors, fonts, shadows } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useIsDesktop } from '../utils/useIsDesktop';

interface SettingsPageProps {
  onNavigate?: (tab: string) => void;
  onShowRules?: () => void;
}

// ── Switch Toggle Component ─────────────────────────────────────────────────
const SwitchToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-12 h-6.5 rounded-full p-0.5 transition cursor-pointer relative border-none flex items-center shrink-0"
      style={{
        background: checked ? '#d4af37' : '#2a2a2a',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="w-5.5 h-5.5 rounded-full transition-transform duration-200"
        style={{
          background: '#151515',
          transform: checked ? 'translateX(22px)' : 'translateX(2px)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
};

// ── Custom Volume Slider Component ──────────────────────────────────────────
const CustomSlider: React.FC<{ value: number; onChange: (v: number) => void }> = ({
  value,
  onChange,
}) => {
  return (
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-36 accent-[#d4af37] cursor-pointer h-1.5 rounded-lg appearance-none transition-all duration-150"
      style={{
        background: `linear-gradient(90deg, #d4af37 0%, #d4af37 ${value}%, #2a2a2a ${value}%, #2a2a2a 100%)`,
      }}
    />
  );
};

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate, onShowRules }) => {
  if (false) onNavigate?.(''); // satisfy unused locals check
  const { user, logout } = useAuth();
  const { settings, updateSetting } = useSettings();
  const isDesktop = useIsDesktop();

  // ── DESKTOP VIEW (Centered Parchment Card) ──────────────────────────────────
  if (isDesktop) {
    return (
      <div
        className="min-h-[85vh] w-full flex items-center justify-center relative overflow-hidden select-none p-6"
        style={{
          background: 'radial-gradient(circle, #4a1010 0%, #150303 100%)',
        }}
      >
        {/* Traditional Gold Corner Clouds */}
        <svg
          className="absolute top-12 right-12 w-48 h-32 opacity-20 pointer-events-none"
          viewBox="0 0 200 120"
          fill="none"
          stroke="#d4af37"
          strokeWidth="1.5"
        >
          <path
            d="M 40,80 Q 20,80 20,60 Q 20,40 40,40 Q 50,20 80,20 Q 110,20 120,40 Q 140,40 140,60 Q 140,80 120,80 Z"
            strokeDasharray="3 3"
          />
          <path d="M 100,90 Q 90,90 90,80 Q 90,70 105,70 Q 110,55 130,55 Q 150,55 155,70 Q 170,70 170,80 Q 170,90 155,90 Z" />
        </svg>

        <svg
          className="absolute bottom-12 left-12 w-48 h-32 opacity-20 pointer-events-none"
          viewBox="0 0 200 120"
          fill="none"
          stroke="#d4af37"
          strokeWidth="1.5"
        >
          <path d="M 40,80 Q 20,80 20,60 Q 20,40 40,40 Q 50,20 80,20 Q 110,20 120,40 Q 140,40 140,60 Q 140,80 120,80 Z" />
          <path
            d="M 100,90 Q 90,90 90,80 Q 90,70 105,70 Q 110,55 130,55 Q 150,55 155,70 Q 170,70 170,80 Q 170,90 155,90 Z"
            strokeDasharray="3 3"
          />
        </svg>

        {/* Centered Settings Card */}
        <div
          className="w-full max-w-[460px] rounded-[28px] p-9 flex flex-col relative z-10"
          style={{
            background: '#faf8f4', // parchment off-white
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            border: '1px solid rgba(212,175,55,0.15)',
          }}
        >
          {/* Card Title */}
          <h2
            className="text-2xl font-black text-center tracking-widest m-0 uppercase"
            style={{
              color: '#4a1010', // Deep burgundy
              fontFamily: fonts.display,
              textShadow: '0 1px 1px rgba(0,0,0,0.05)',
            }}
          >
            Settings
          </h2>

          {/* Separator line */}
          <div
            className="w-full h-[1px] my-5"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(110,90,64,0.2) 20%, rgba(110,90,64,0.2) 80%, transparent)',
            }}
          />

          {/* Settings Items */}
          <div className="flex flex-col gap-6 font-semibold text-sm">
            {/* Item 1: Mute all sound */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-black" style={{ color: '#000000' }}>
                Mute all sound
              </span>
              <SwitchToggle
                checked={settings.muteAll ?? false}
                onChange={(v) => updateSetting('muteAll', v)}
              />
            </div>

            {/* Item 2: Effects volume */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-black" style={{ color: '#000000' }}>
                Effects volume
              </span>
              <CustomSlider
                value={settings.sfxVolume ?? 25}
                onChange={(v) => updateSetting('sfxVolume', v)}
              />
            </div>

            {/* Item 3: Tavern music */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-black" style={{ color: '#000000' }}>
                Tavern music
              </span>
              <SwitchToggle
                checked={settings.musicEnabled ?? true}
                onChange={(v) => updateSetting('musicEnabled', v)}
              />
            </div>

            {/* Item 4: Music volume */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-black" style={{ color: '#000000' }}>
                Music volume
              </span>
              <CustomSlider
                value={settings.musicVolume ?? 10}
                onChange={(v) => updateSetting('musicVolume', v)}
              />
            </div>

            {/* Item 5: Language Selection */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-black" style={{ color: '#000000' }}>
                Language
              </span>
              <button
                onClick={() => updateSetting('language', settings.language === 'en' ? 'mn' : 'en')}
                className="px-4.5 py-2.5 rounded-full border text-[11px] font-black tracking-wider uppercase transition cursor-pointer hover:scale-102"
                style={{
                  background: '#fcfaf5',
                  borderColor: 'rgba(212,175,55,0.4)',
                  color: '#d4af37',
                  fontFamily: fonts.display,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                }}
              >
                {settings.language === 'en' ? 'English ➔ Монгол' : 'Монгол ➔ English'}
              </button>
            </div>

            {/* Item 6: How to play */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-black" style={{ color: '#000000' }}>
                How to play
              </span>
              <button
                onClick={onShowRules}
                className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs cursor-pointer border hover:scale-105 active:scale-95 transition"
                style={{
                  background: '#fcfaf5',
                  borderColor: '#d4af37',
                  color: '#d4af37',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
              >
                ?
              </button>
            </div>
          </div>

          {/* Footer centered links */}
          <div
            className="flex items-center justify-center gap-4 mt-8 pt-4 border-t border-[rgba(110,90,64,0.08)] text-[10px] font-bold"
            style={{ color: 'rgba(110,90,64,0.5)', fontFamily: fonts.body }}
          >
            <a href="#privacy" className="hover:text-[#6e5a40] transition underline">
              Privacy Policy
            </a>
            <a href="#terms" className="hover:text-[#6e5a40] transition underline">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE VIEW ─────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-transparent text-white pb-28 select-none"
      style={{
        paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex items-center gap-2.5 px-6 mb-6">
        <img src="/assets/logo.png" alt="Muushig Logo" className="w-8 h-8 object-contain" />
        <span
          className="text-xl font-black font-display uppercase tracking-wider"
          style={{
            backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Muushig
        </span>
      </div>

      <div className="px-4 flex flex-col gap-5">
        {/* User Card */}
        <div
          className="rounded-2xl border p-5 flex items-center justify-between relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.85), rgba(20,5,5,0.95))',
            borderColor: 'rgba(212,175,55,0.38)',
            boxShadow: shadows.mid,
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-14 h-14 rounded-full border-2 overflow-hidden shadow-md"
              style={{
                borderColor: '#d4af37',
                background: 'linear-gradient(180deg, #2a0a0a, #5b1818)',
              }}
            >
              <img
                src="/assets/mongolian_boy.png"
                alt={user ? user.username : 'Gombo_Khan'}
                className="w-full h-full object-cover scale-105"
              />
            </div>
            <div>
              <h2
                className="text-base font-black font-display text-white tracking-wide leading-tight"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
              >
                {user ? user.username : 'Gombo_Khan'}
              </h2>
              <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                Member Plan
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-black/30 border border-[rgba(212,175,55,0.22)] px-3 py-1 rounded-full">
            <img src="/assets/coin.png" alt="Coins" className="w-4.5 h-4.5 object-contain" />
            <span
              className="text-xs font-black font-display tracking-wide"
              style={{ color: colors.gold[300] }}
            >
              {user ? '1,200' : '0'}
            </span>
          </div>
        </div>

        {/* Sound & Audio Group */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.45), rgba(20,5,5,0.65))',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
          }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wider font-display border-b border-[rgba(212,175,55,0.08)] pb-2"
            style={{ color: colors.gold[400] }}
          >
            Sound & Audio
          </div>

          <div className="flex flex-col gap-4 font-semibold text-sm">
            <div className="flex justify-between items-center">
              <span>Mute all sound</span>
              <SwitchToggle
                checked={settings.muteAll ?? false}
                onChange={(v) => updateSetting('muteAll', v)}
              />
            </div>
            <div className="flex justify-between items-center">
              <span>Effects volume</span>
              <CustomSlider
                value={settings.sfxVolume ?? 25}
                onChange={(v) => updateSetting('sfxVolume', v)}
              />
            </div>
            <div className="flex justify-between items-center">
              <span>Tavern music</span>
              <SwitchToggle
                checked={settings.musicEnabled ?? true}
                onChange={(v) => updateSetting('musicEnabled', v)}
              />
            </div>
            <div className="flex justify-between items-center">
              <span>Music volume</span>
              <CustomSlider
                value={settings.musicVolume ?? 10}
                onChange={(v) => updateSetting('musicVolume', v)}
              />
            </div>
          </div>
        </div>

        {/* Preferences Group */}
        <div
          className="rounded-2xl border overflow-hidden flex flex-col"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.45), rgba(20,5,5,0.65))',
            borderColor: 'rgba(212,175,55,0.22)',
          }}
        >
          <div className="px-5 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-[rgba(216,200,156,0.55)] font-display">
            Preferences & Help
          </div>
          <div className="flex items-center justify-between px-5 py-3 text-sm font-semibold text-white border-b border-[rgba(212,175,55,0.06)]">
            <span>Language</span>
            <select
              value={settings.language}
              onChange={(e) => updateSetting('language', e.target.value as 'en' | 'mn')}
              className="bg-black/30 text-xs font-bold text-[#d4af37] border border-[rgba(212,175,55,0.22)] px-3 py-1 rounded-lg outline-none"
            >
              <option value="en">EN</option>
              <option value="mn">MN</option>
            </select>
          </div>
          <button
            onClick={onShowRules}
            className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-white bg-transparent border-none cursor-pointer border-b border-[rgba(212,175,55,0.06)] hover:bg-black/10"
          >
            <span>How to play</span>
            <span className="text-[rgba(216,200,156,0.4)] text-lg">?</span>
          </button>
          {user && (
            <button
              onClick={logout}
              className="flex items-center justify-between px-5 py-4 text-sm font-black text-red-400 bg-transparent border-none cursor-pointer hover:bg-black/10"
            >
              <span>Log Out</span>
              <span className="text-red-400/40 text-lg">›</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
