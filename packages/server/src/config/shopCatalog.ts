export type ItemType = 'cardBack' | 'tableSkin' | 'emote';

export interface ShopItem {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  price: number;
  preview: string; // emoji or hex color or url key
  image?: string; // path relative to /assets/ for image previews
  premiumOnly?: boolean; // exclusive to premium members
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
    image: 'cardbacks/cardback_classic.png',
  },
  {
    id: 'cardback_midnight',
    type: 'cardBack',
    name: 'Midnight Blue',
    description: 'Deep navy card back',
    price: 200,
    preview: '#1a237e',
    image: 'cardbacks/cardback_midnight.png',
  },
  {
    id: 'cardback_forest',
    type: 'cardBack',
    name: 'Forest Green',
    description: 'Rich emerald finish',
    price: 200,
    preview: '#1b5e20',
    image: 'cardbacks/cardback_forest.png',
  },
  {
    id: 'cardback_gold',
    type: 'cardBack',
    name: 'Gold Rush',
    description: 'Shimmering gold card back',
    price: 500,
    preview: '#f9a825',
    image: 'cardbacks/cardback_gold.png',
  },
  {
    id: 'cardback_galaxy',
    type: 'cardBack',
    name: 'Galaxy',
    description: 'Cosmic purple starfield',
    price: 800,
    preview: '#4a148c',
    image: 'cardbacks/cardback_galaxy.png',
  },
  {
    id: 'cardback_obsidian',
    type: 'cardBack',
    name: 'Obsidian',
    description: 'Sleek black finish',
    price: 600,
    preview: '#111111',
    image: 'cardbacks/cardback_obsidian.png',
  },
  {
    id: 'cardback_filigree',
    type: 'cardBack',
    name: 'Imperial Filigree',
    description: 'Gold baroque filigree on premium dark leather',
    price: 1500,
    preview: '#d4af37',
    image: 'cardbacks/cardback_filigree.png',
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
    image: 'emotes/emote_gg.png',
  },
  {
    id: 'emote_fire',
    type: 'emote',
    name: 'Fire',
    description: 'That was lit',
    price: 150,
    preview: '🔥',
    image: 'emotes/emote_fire.png',
  },
  {
    id: 'emote_think',
    type: 'emote',
    name: 'Thinking',
    description: 'Hmm...',
    price: 150,
    preview: '🤔',
    image: 'emotes/emote_think.png',
  },
  {
    id: 'emote_laugh',
    type: 'emote',
    name: 'Laugh',
    description: "That's hilarious",
    price: 150,
    preview: '😂',
    image: 'emotes/emote_laugh.png',
  },
  {
    id: 'emote_crown',
    type: 'emote',
    name: 'Crown',
    description: 'All hail the winner',
    price: 400,
    preview: '👑',
    image: 'emotes/emote_crown.png',
  },
  {
    id: 'emote_skull',
    type: 'emote',
    name: 'Skull',
    description: 'You are cooked',
    price: 400,
    preview: '💀',
    image: 'emotes/emote_skull.png',
  },
  {
    id: 'emote_100',
    type: 'emote',
    name: 'Perfection',
    description: 'Flawless play',
    price: 600,
    preview: '💯',
    image: 'emotes/emote_100.png',
  },

  // ── Premium exclusives (free for premium members, locked otherwise) ──────────
  {
    id: 'cardback_royal',
    type: 'cardBack',
    name: 'Royal Purple',
    description: 'Exclusive deep violet card back for premium members',
    price: 0,
    preview: '#6a0dad',
    premiumOnly: true,
  },
  {
    id: 'table_velvet',
    type: 'tableSkin',
    name: 'Black Velvet',
    description: 'Ultra-premium black velvet table surface',
    price: 0,
    preview: '#0a0a0a',
    premiumOnly: true,
  },
  {
    id: 'emote_diamond',
    type: 'emote',
    name: 'Diamond',
    description: 'Flex your premium status',
    price: 0,
    preview: '💎',
    premiumOnly: true,
  },
];

export const FREE_ITEM_IDS = new Set(SHOP_ITEMS.filter((i) => i.price === 0 && !i.premiumOnly).map((i) => i.id));
export const PREMIUM_ITEM_IDS = new Set(SHOP_ITEMS.filter((i) => i.premiumOnly).map((i) => i.id));
