export type ItemType = 'cardBack' | 'tableSkin' | 'emote';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ShopItem {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  price: number;
  preview: string;
  image?: string;
  premiumOnly?: boolean;
}

export interface ShopState {
  coins: number;
  inventory: string[];
  equippedCardBack: string;
  equippedTableSkin: string;
  equippedEmotes: string[];
  isPremium: boolean;
}

export const API = '/api';

export const rarityFor = (price: number): Rarity => {
  if (price === 0) return 'common';
  if (price <= 300) return 'rare';
  if (price <= 700) return 'epic';
  return 'legendary';
};

export const RARITY: Record<
  Rarity,
  {
    cardGradient: string;
    border: string;
    topBar: string;
    glow: string;
    label: string;
    stars: number;
    starColor: string;
  }
> = {
  common: {
    cardGradient: 'linear-gradient(175deg, #f5ead0 0%, #ebe0c4 55%, #d8c89c 100%)', // Parchment
    border: 'rgba(212,175,55,0.5)', // Gold outline
    topBar: 'linear-gradient(90deg, #ebe0c4, #faf3dd, #ebe0c4)',
    glow: 'rgba(212,175,55,0.2)',
    label: 'COMMON',
    stars: 1,
    starColor: '#d4af37',
  },
  rare: {
    cardGradient: 'linear-gradient(175deg, #135c3f 0%, #0a3624 55%, #04150e 100%)', // Felt Green
    border: '#e6c258', // Light Gold
    topBar: 'linear-gradient(90deg, #0a3624, #135c3f, #0a3624)',
    glow: 'rgba(230,194,88,0.3)',
    label: 'RARE',
    stars: 2,
    starColor: '#e6c258',
  },
  epic: {
    cardGradient: 'linear-gradient(175deg, #8b2121 0%, #5b1818 55%, #2a0a0a 100%)', // Velvet Burgundy
    border: '#f4d774', // Soft Gold
    topBar: 'linear-gradient(90deg, #5b1818, #8b2121, #5b1818)',
    glow: 'rgba(244,215,116,0.4)',
    label: 'EPIC',
    stars: 3,
    starColor: '#f4d774',
  },
  legendary: {
    cardGradient: 'linear-gradient(175deg, #d4af37 0%, #b8902a 55%, #4a3608 100%)', // Pure Gold
    border: '#f4d774',
    topBar: 'linear-gradient(90deg, #b8902a, #f4d774, #b8902a)',
    glow: 'rgba(212,175,55,0.6)',
    label: 'LEGENDARY',
    stars: 3,
    starColor: '#fcd34d',
  },
};
