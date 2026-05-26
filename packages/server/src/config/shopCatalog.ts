export type ItemType = 'cardBack' | 'tableSkin' | 'emote';

export interface ShopItem {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  price: number;
  preview: string; // emoji or hex color or url key
}

export const SHOP_ITEMS: ShopItem[] = [
  // Card backs
  {
    id: 'cardback_classic',
    type: 'cardBack',
    name: 'Classic Red',
    description: 'Timeless red diamond pattern',
    price: 0,
    preview: '#c0392b',
  },
  {
    id: 'cardback_midnight',
    type: 'cardBack',
    name: 'Midnight Blue',
    description: 'Deep navy card back',
    price: 200,
    preview: '#1a237e',
  },
  {
    id: 'cardback_forest',
    type: 'cardBack',
    name: 'Forest Green',
    description: 'Rich emerald finish',
    price: 200,
    preview: '#1b5e20',
  },
  {
    id: 'cardback_gold',
    type: 'cardBack',
    name: 'Gold Rush',
    description: 'Shimmering gold card back',
    price: 500,
    preview: '#f9a825',
  },
  {
    id: 'cardback_galaxy',
    type: 'cardBack',
    name: 'Galaxy',
    description: 'Cosmic purple starfield',
    price: 800,
    preview: '#4a148c',
  },

  // Table skins
  {
    id: 'table_classic',
    type: 'tableSkin',
    name: 'Classic Felt',
    description: 'Standard green felt table',
    price: 0,
    preview: '#1b5e20',
  },
  {
    id: 'table_navy',
    type: 'tableSkin',
    name: 'Navy Felt',
    description: 'Cool navy blue table',
    price: 300,
    preview: '#0d47a1',
  },
  {
    id: 'table_crimson',
    type: 'tableSkin',
    name: 'Crimson',
    description: 'Bold red table surface',
    price: 300,
    preview: '#b71c1c',
  },
  {
    id: 'table_obsidian',
    type: 'tableSkin',
    name: 'Obsidian',
    description: 'Dark slate luxury finish',
    price: 600,
    preview: '#212121',
  },
  {
    id: 'table_aurora',
    type: 'tableSkin',
    name: 'Aurora',
    description: 'Northern lights gradient',
    price: 1000,
    preview: '#006064',
  },

  // Emotes
  {
    id: 'emote_gg',
    type: 'emote',
    name: 'GG',
    description: 'Good game!',
    price: 0,
    preview: '🤝',
  },
  {
    id: 'emote_fire',
    type: 'emote',
    name: 'Fire',
    description: 'That was lit',
    price: 150,
    preview: '🔥',
  },
  {
    id: 'emote_think',
    type: 'emote',
    name: 'Thinking',
    description: 'Hmm...',
    price: 150,
    preview: '🤔',
  },
  {
    id: 'emote_laugh',
    type: 'emote',
    name: 'Laugh',
    description: "That's hilarious",
    price: 150,
    preview: '😂',
  },
  {
    id: 'emote_crown',
    type: 'emote',
    name: 'Crown',
    description: 'All hail the winner',
    price: 400,
    preview: '👑',
  },
  {
    id: 'emote_skull',
    type: 'emote',
    name: 'Skull',
    description: 'You are cooked',
    price: 400,
    preview: '💀',
  },
  {
    id: 'emote_100',
    type: 'emote',
    name: 'Perfection',
    description: 'Flawless play',
    price: 600,
    preview: '💯',
  },
];

export const FREE_ITEM_IDS = new Set(SHOP_ITEMS.filter((i) => i.price === 0).map((i) => i.id));
