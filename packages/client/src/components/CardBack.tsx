import React from 'react';
import { useCardBack } from '../contexts/CardBackContext';

interface CardBackProps {
  className?: string;
  style?: React.CSSProperties;
}

export const CardBack: React.FC<CardBackProps> = ({ className = '', style }) => {
  const { imageUrl } = useCardBack();

  if (imageUrl) {
    return (
      <div
        className={`w-full h-full rounded-lg overflow-hidden border border-white/20 shadow-md ${className}`}
        style={style}
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
    );
  }

  // Default fallback
  return (
    <div
      className={`w-full h-full rounded-lg border-2 border-red-400 bg-red-900 flex items-center justify-center shadow-lg select-none ${className}`}
      style={style}
    >
      <div className="w-[calc(100%-10px)] h-[calc(100%-10px)] rounded border border-red-300/40 bg-red-950 flex items-center justify-center">
        <span className="text-red-300 text-3xl">♦</span>
      </div>
    </div>
  );
};
