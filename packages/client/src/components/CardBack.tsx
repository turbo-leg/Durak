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

  // Default fallback — on-brand felt/gold back so a missing asset still looks intentional.
  return (
    <div
      className={`w-full h-full rounded-lg flex items-center justify-center select-none ${className}`}
      style={{
        border: '2px solid rgba(212,175,55,0.55)',
        background: 'linear-gradient(170deg, #0a3624 0%, #07261a 60%, #04150e 100%)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        padding: 5,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        className="w-full h-full rounded flex items-center justify-center"
        style={{ border: '1px solid rgba(212,175,55,0.3)' }}
      >
        <span style={{ color: 'rgba(212,175,55,0.85)', fontSize: '1.875rem' }}>♦</span>
      </div>
    </div>
  );
};
