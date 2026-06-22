import React from 'react';
import { CARD_ASPECT, cardImageSrc, suitWord } from '../utils/cardAssets';

// Renders a real playing-card face from the bundled Vector Playing Cards SVG deck.
// The source SVGs carry a bogus intrinsic width/height (landscape) that conflicts
// with their portrait viewBox, so we pin the aspect ratio here.

interface PlayingCardProps {
  suit: string;
  rank: string | number;
  /** Card width in px (height derives from the fixed aspect unless `height` is given). */
  width?: number | string;
  height?: number | string;
  /** Apply a soft drop-shadow that hugs the card's rounded shape. Off by default
   *  so containers can own the shadow and we never double up / clip corners. */
  shadow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  suit,
  rank,
  width = 64,
  height,
  shadow = false,
  className = '',
  style,
  draggable = false,
}) => {
  const src = cardImageSrc(suit, rank);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={`${rank} of ${suitWord(suit) ?? suit}`}
      draggable={draggable}
      className={className}
      style={{
        width,
        height: height ?? 'auto',
        aspectRatio: height ? undefined : `${CARD_ASPECT}`,
        display: 'block',
        // drop-shadow follows the SVG's rounded alpha shape (no rectangular edges).
        filter: shadow ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' : undefined,
        ...style,
      }}
    />
  );
};
