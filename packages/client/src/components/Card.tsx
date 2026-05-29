import React from 'react';
import { Card as CardType } from '@durak/shared';

interface CardProps {
  card: CardType;
  onClick?: (card: CardType) => void;
  className?: string;
  isPlayable?: boolean;
  compact?: boolean;
}

const suitSymbols: Record<string, string> = {
  Spades: '♠',
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  None: '',
};

const isRed = (suit: string) => suit === 'Hearts' || suit === 'Diamonds';

const rankNames: Record<number, string> = {
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: '3',
  15: '2',
  16: 'A',
  17: 'JK',
  18: 'RJ',
};

export const Card: React.FC<CardProps> = ({
  card,
  onClick,
  className = '',
  isPlayable = false,
  compact = false,
}) => {
  const red = !card.isJoker && isRed(card.suit);
  const symbol = card.isJoker ? '★' : suitSymbols[card.suit];
  const name = rankNames[card.rank] || String(card.rank);

  const cardLabel = card.isJoker ? `${name} Joker` : `${name} of ${card.suit}`;
  const ariaLabel = onClick ? (isPlayable ? `Play ${cardLabel}` : cardLabel) : cardLabel;

  const inkColor = red ? '#a01818' : '#1b150a';
  const watermark = red ? '#a01818' : '#3a2a14';

  // Shared visual styles
  const baseStyle: React.CSSProperties = {
    position: 'relative',
    background: 'linear-gradient(170deg, #faf3dd 0%, #ebe0c4 60%, #d8c89c 100%)',
    color: inkColor,
    boxShadow: isPlayable
      ? '0 8px 20px rgba(0,0,0,0.45), 0 0 0 2px rgba(212,175,55,0.55), inset 0 0 0 1px rgba(255,255,255,0.6)'
      : '0 4px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.4)',
    border: '1px solid rgba(139,105,20,0.55)',
    fontFamily: "'Cinzel', Georgia, serif",
    cursor: isPlayable ? 'pointer' : 'default',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    userSelect: 'none',
  };

  if (compact) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        aria-disabled={onClick ? !isPlayable : true}
        disabled={onClick ? !isPlayable : true}
        tabIndex={!onClick || !isPlayable ? -1 : undefined}
        className={`w-12${className ? ` ${className}` : ''}`}
        style={{
          ...baseStyle,
          width: 48,
          height: 72,
          borderRadius: 6,
          padding: '3px 4px',
          fontSize: 11,
          fontWeight: 800,
          opacity: isPlayable ? 1 : 0.92,
        }}
        onClick={() => isPlayable && onClick?.(card)}
      >
        <div
          style={{
            lineHeight: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <span>{name}</span>
          <span style={{ fontSize: 12, marginTop: -1 }}>{symbol}</span>
        </div>
        <div
          style={{
            lineHeight: 1,
            transform: 'rotate(180deg)',
            alignSelf: 'flex-end',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>{name}</span>
          <span style={{ fontSize: 12, marginTop: -1 }}>{symbol}</span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={onClick ? !isPlayable : true}
      disabled={onClick ? !isPlayable : true}
      tabIndex={!onClick || !isPlayable ? -1 : undefined}
      className={`${isPlayable ? 'cursor-pointer' : ''}${className ? ` ${className}` : ''}`}
      style={{
        ...baseStyle,
        width: 'clamp(64px, 8vw, 96px)',
        height: 'clamp(94px, 12vw, 142px)',
        borderRadius: 10,
        padding: '8px 9px',
        transform: isPlayable ? undefined : undefined,
        opacity: isPlayable ? 1 : 0.94,
      }}
      onClick={() => isPlayable && onClick?.(card)}
      onMouseEnter={(e) => {
        if (isPlayable) e.currentTarget.style.transform = 'translateY(-14px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Top-left rank/suit */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1,
          textShadow: '0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        <div>{name}</div>
        <div style={{ fontSize: 18, marginTop: 2 }}>{symbol}</div>
      </div>

      {/* Centre embossed watermark suit */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 56,
          color: watermark,
          opacity: 0.16,
          textShadow: '0 2px 0 rgba(255,255,255,0.4)',
          pointerEvents: 'none',
        }}
      >
        {symbol}
      </div>

      {/* Gold inset frame */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 4,
          border: '1px solid rgba(139,105,20,0.35)',
          borderRadius: 7,
          pointerEvents: 'none',
        }}
      />

      {/* Bottom-right rank/suit (rotated) */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1,
          transform: 'rotate(180deg)',
          alignSelf: 'flex-end',
          textShadow: '0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        <div>{name}</div>
        <div style={{ fontSize: 18, marginTop: 2 }}>{symbol}</div>
      </div>
    </button>
  );
};
