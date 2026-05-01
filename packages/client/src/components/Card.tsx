import React from 'react';
import { Card as CardType } from '@durak/shared';

interface CardProps {
  card: CardType;
  onClick?: (card: CardType) => void;
  className?: string;
  isPlayable?: boolean;
}

const suitSymbols: Record<string, string> = {
  Spades: '♠',
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  None: '',
};

const suitColors: Record<string, string> = {
  Spades: 'text-gray-800',
  Clubs: 'text-gray-800',
  Hearts: 'text-red-600',
  Diamonds: 'text-red-600',
  None: 'text-gray-800',
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
}) => {
  const colorClass = suitColors[card.suit] || 'text-black';
  const symbol = card.isJoker ? '★' : suitSymbols[card.suit];
  const name = rankNames[card.rank] || String(card.rank);

  return (
    <div
      className={`
        relative w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 bg-white rounded-lg shadow-md border border-gray-200 
        flex flex-col justify-between p-1 md:p-2 select-none 
        transition-transform duration-200
        ${isPlayable ? 'cursor-pointer hover:-translate-y-4 hover:shadow-xl hover:ring-2 hover:ring-yellow-400' : 'opacity-90'}
        ${className}
      `}
      onClick={() => isPlayable && onClick?.(card)}
    >
      {/* Top Left */}
      <div className={`text-base md:text-lg font-bold leading-none ${colorClass}`}>
        <div>{name}</div>
        <div className="text-lg md:text-xl -mt-1 md:-mt-1">{symbol}</div>
      </div>

      {/* Center Large Symbol */}
      <div
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl opacity-20 ${colorClass}`}
      >
        {symbol}
      </div>

      {/* Bottom Right */}
      <div className={`text-lg font-bold leading-none ${colorClass} rotate-180 self-end`}>
        <div>{name}</div>
        <div className="text-xl -mt-1">{symbol}</div>
      </div>
    </div>
  );
};
