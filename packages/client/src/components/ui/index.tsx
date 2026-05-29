import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, gradients, shadows, radii, fonts } from '../../theme';

// ── GoldButton ────────────────────────────────────────────────────────────────
// Primary CTA. Embossed gold with engraved inner shadow.

export interface GoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'burgundy' | 'ghost' | 'felt';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
}

export const GoldButton: React.FC<GoldButtonProps> = ({
  variant = 'gold',
  size = 'md',
  block = false,
  loading = false,
  iconLeft,
  children,
  disabled,
  style,
  ...rest
}) => {
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 12, gap: 6 },
    md: { padding: '12px 22px', fontSize: 14, gap: 8 },
    lg: { padding: '16px 28px', fontSize: 16, gap: 10 },
  } as const;

  const variantStyles: Record<string, React.CSSProperties> = {
    gold: {
      background: gradients.gold,
      color: colors.ink[900],
      border: '1.5px solid rgba(212,175,55,0.7)',
      boxShadow: `${shadows.mid}, ${shadows.engrave}, ${shadows.goldGlow}`,
      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
    },
    burgundy: {
      background: gradients.burgundyLight,
      color: colors.ivory[100],
      border: `1.5px solid ${colors.burgundy[500]}`,
      boxShadow: `${shadows.mid}, ${shadows.engrave}`,
      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
    },
    ghost: {
      background: 'rgba(212,175,55,0.06)',
      color: colors.gold[300],
      border: '1.5px solid rgba(212,175,55,0.35)',
      boxShadow: shadows.engrave,
      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
    },
    felt: {
      background: gradients.velvet,
      color: colors.ivory[100],
      border: '1.5px solid rgba(212,175,55,0.22)',
      boxShadow: `${shadows.low}, ${shadows.engrave}`,
      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
    },
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.025 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      disabled={disabled || loading}
      style={{
        ...sizes[size],
        width: block ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        fontWeight: 800,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.55 : 1,
        transition: 'background 0.18s, transform 0.05s',
        fontFamily: fonts.body,
        ...variantStyles[variant],
        ...style,
      }}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {iconLeft && <span style={{ display: 'inline-flex' }}>{iconLeft}</span>}
      <span>{loading ? '…' : children}</span>
    </motion.button>
  );
};

// ── Panel ─────────────────────────────────────────────────────────────────────

export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...rest
}) => (
  <div
    style={{
      background: gradients.panel,
      border: '1px solid rgba(212,175,55,0.22)',
      borderRadius: radii.lg,
      boxShadow: `${shadows.mid}, ${shadows.engrave}`,
      backdropFilter: 'blur(10px)',
      padding: 20,
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

// ── Pill (small status chip / segmented option) ───────────────────────────────

export const Pill: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'gold' | 'burgundy';
}> = ({ active, onClick, children, variant = 'gold' }) => {
  const activeStyles =
    variant === 'gold'
      ? {
          background: gradients.gold,
          color: colors.ink[900],
          border: '1.5px solid rgba(212,175,55,0.8)',
          boxShadow: `${shadows.engrave}, ${shadows.goldGlow}`,
          textShadow: '0 1px 0 rgba(255,255,255,0.25)',
        }
      : {
          background: gradients.burgundyLight,
          color: colors.ivory[100],
          border: `1.5px solid ${colors.burgundy[500]}`,
          boxShadow: shadows.engrave,
        };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: radii.pill,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        ...(active
          ? activeStyles
          : {
              background: 'rgba(255,255,255,0.03)',
              color: colors.ivory[300],
              border: '1px solid rgba(212,175,55,0.15)',
              boxShadow: shadows.engrave,
            }),
      }}
    >
      {children}
    </button>
  );
};

// ── Sheet (bottom modal) ──────────────────────────────────────────────────────

export const Sheet: React.FC<{
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, icon, onClose, children }) => (
  <AnimatePresence>
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(8px)',
        }}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 34 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: gradients.velvet,
          borderTop: `1px solid ${colors.gold[700]}`,
          borderRadius: `${radii.xl}px ${radii.xl}px 0 0`,
          maxHeight: '92dvh',
          overflowY: 'auto',
          boxShadow: shadows.deep,
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div
            style={{
              width: 44,
              height: 4,
              borderRadius: 99,
              background: 'rgba(212,175,55,0.4)',
            }}
          />
        </div>

        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 22px 4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon && <span style={{ fontSize: 24 }}>{icon}</span>}
            <h2
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 20,
                color: colors.gold[300],
                letterSpacing: 1.5,
                margin: 0,
                textTransform: 'uppercase',
                textShadow: '0 1px 2px rgba(0,0,0,0.7)',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(212,175,55,0.25)',
              color: colors.ivory[200],
              borderRadius: 99,
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* gold divider with center diamond */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '12px 22px 18px',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
            }}
          />
          <span style={{ color: colors.gold[500], fontSize: 8, opacity: 0.7 }}>◆</span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
            }}
          />
        </div>

        <div style={{ padding: '0 22px 28px' }}>{children}</div>
      </motion.div>
    </>
  </AnimatePresence>
);

// ── SectionLabel ──────────────────────────────────────────────────────────────

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: fonts.display,
      fontSize: 11,
      fontWeight: 700,
      color: colors.gold[400],
      letterSpacing: 2.5,
      textTransform: 'uppercase',
      marginBottom: 10,
      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
    }}
  >
    {children}
  </div>
);

// ── Divider with diamond ──────────────────────────────────────────────────────

export const Divider: React.FC<{ label?: React.ReactNode }> = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
    <div
      style={{
        flex: 1,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)',
      }}
    />
    {label && (
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 10,
          letterSpacing: 2,
          color: colors.gold[400],
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    )}
    <div
      style={{
        flex: 1,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)',
      }}
    />
  </div>
);

// ── TextInput ─────────────────────────────────────────────────────────────────

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  style,
  ...rest
}) => (
  <input
    {...rest}
    style={{
      width: '100%',
      padding: '12px 14px',
      borderRadius: radii.sm,
      background: 'rgba(0,0,0,0.4)',
      border: '1.5px solid rgba(212,175,55,0.25)',
      color: colors.ivory[100],
      fontSize: 14,
      fontFamily: fonts.body,
      outline: 'none',
      boxSizing: 'border-box',
      boxShadow: shadows.engrave,
      transition: 'border-color 0.15s, box-shadow 0.15s',
      ...style,
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = colors.gold[400];
      e.currentTarget.style.boxShadow = `${shadows.engrave}, 0 0 0 3px rgba(212,175,55,0.15)`;
    }}
    onBlur={(e) => {
      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)';
      e.currentTarget.style.boxShadow = shadows.engrave;
    }}
  />
);

// ── Select (styled native <select>) ───────────────────────────────────────────

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  style,
  children,
  ...rest
}) => (
  <select
    {...rest}
    style={{
      width: '100%',
      padding: '12px 14px',
      borderRadius: radii.sm,
      background: 'rgba(0,0,0,0.4)',
      border: '1.5px solid rgba(212,175,55,0.25)',
      color: colors.ivory[100],
      fontSize: 14,
      fontFamily: fonts.body,
      fontWeight: 600,
      outline: 'none',
      boxSizing: 'border-box',
      boxShadow: shadows.engrave,
      appearance: 'none',
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M1 1l5 5 5-5' stroke='%23d4af37' stroke-width='2' fill='none'/></svg>\")",
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 14px center',
      paddingRight: 36,
      cursor: 'pointer',
      ...style,
    }}
  >
    {children}
  </select>
);

// ── Diamond ornament ──────────────────────────────────────────────────────────

export const Diamond: React.FC<{ size?: number; color?: string }> = ({
  size = 10,
  color = colors.gold[500],
}) => <span style={{ color, fontSize: size, lineHeight: 1, opacity: 0.85 }}>◆</span>;
