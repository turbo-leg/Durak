import React from 'react';
import { Card as CardType } from '@durak/shared';
import { cardImageSrc } from '../utils/cardAssets';

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
  const symbol = card.isJoker ? '★' : suitSymbols[card.suit];
  const name = rankNames[card.rank] || String(card.rank);

  const cardLabel = card.isJoker ? `${name} Joker` : `${name} of ${card.suit}`;
  const ariaLabel = onClick ? (isPlayable ? `Play ${cardLabel}` : cardLabel) : cardLabel;

  // Real card art from the bundled SVG deck. Jokers fall back to the deck's joker faces.
  const imgSrc = card.isJoker
    ? card.rank === 18
      ? '/assets/cards/red_joker.svg'
      : '/assets/cards/black_joker.svg'
    : cardImageSrc(card.suit, card.rank);

  // Accessible rank/suit text kept in the DOM (visually hidden) — the SVG carries the visuals.
  const a11yText = (
    <>
      <span className="sr-only">{name}</span>
      <span className="sr-only">{symbol}</span>
    </>
  );

  const faceStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    userSelect: 'none',
    pointerEvents: 'none',
  };

  // drop-shadow follows the card SVG's rounded alpha shape, so there are no stray
  // rectangular edges when cards overlap (e.g. after a mass defense).
  const baseStyle: React.CSSProperties = {
    position: 'relative',
    filter: isPlayable
      ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.5)) drop-shadow(0 0 5px rgba(212,175,55,0.8))'
      : 'drop-shadow(0 4px 9px rgba(0,0,0,0.45))',
    cursor: isPlayable ? 'pointer' : 'default',
    transition: 'transform 0.18s ease, filter 0.18s ease',
    padding: 0,
    border: 'none',
    background: 'transparent',
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
          opacity: isPlayable ? 1 : 0.92,
        }}
        onClick={() => isPlayable && onClick?.(card)}
      >
        {imgSrc && <img src={imgSrc} alt="" draggable={false} style={faceStyle} />}
        {a11yText}
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
        width: 'clamp(48px, 6vw, 76px)',
        height: 'clamp(70px, 8.7vw, 110px)',
        borderRadius: 10,
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
      {imgSrc && <img src={imgSrc} alt="" draggable={false} style={faceStyle} />}
      {a11yText}
    </button>
  );
};
