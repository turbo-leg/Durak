import mongoose from 'mongoose';

export interface IPlayerSettings {
  soundEffects: boolean;
  animations: boolean;
  showTimer: boolean;
  confirmLeave: boolean;
  language: string;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muteAll: boolean;
  musicEnabled: boolean;
}

export interface IPlayerPremium {
  active: boolean;
  grantedAt: Date | null;
  source: string; // 'qpay' | 'promo' | 'admin'
  orderId: string;
}

export interface IPlayerProfile extends mongoose.Document {
  discordId: string;
  userId: string;
  username: string;
  avatarUrl: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    durakCount: number;
    winStreak: number;
    durakFreeStreak: number;
  };
  eloClassic: number;
  eloTeams: number;
  badges: string[];
  coins: number;
  inventory: string[];
  equippedCardBack: string;
  equippedTableSkin: string;
  equippedEmotes: string[];
  settings: IPlayerSettings;
  premium: IPlayerPremium;
  deviceTokens: string[];
  updatedAt: Date;
}

const PlayerProfileSchema = new mongoose.Schema(
  {
    discordId: { type: String, default: '', index: true, sparse: true },
    userId: { type: String, default: '', index: true, sparse: true },
    username: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      durakCount: { type: Number, default: 0 },
      winStreak: { type: Number, default: 0 },
      durakFreeStreak: { type: Number, default: 0 },
    },
    eloClassic: { type: Number, default: 1000 },
    eloTeams: { type: Number, default: 1000 },
    badges: { type: [String], default: [] },
    coins: { type: Number, default: 0 },
    inventory: { type: [String], default: [] },
    equippedCardBack: { type: String, default: '' },
    equippedTableSkin: { type: String, default: '' },
    equippedEmotes: { type: [String], default: [] },
    premium: {
      active: { type: Boolean, default: false },
      grantedAt: { type: Date, default: null },
      source: { type: String, default: '' },
      orderId: { type: String, default: '' },
    },
    settings: {
      soundEffects: { type: Boolean, default: true },
      animations: { type: Boolean, default: true },
      showTimer: { type: Boolean, default: true },
      confirmLeave: { type: Boolean, default: true },
      language: { type: String, default: 'en', enum: ['en', 'mn'] },
      masterVolume: { type: Number, default: 30 },
      musicVolume: { type: Number, default: 10 },
      sfxVolume: { type: Number, default: 25 },
      muteAll: { type: Boolean, default: false },
      musicEnabled: { type: Boolean, default: true },
    },
    deviceTokens: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Compound indexes to cover leaderboard query: filter by gamesPlayed, sort by elo
PlayerProfileSchema.index({ 'stats.gamesPlayed': 1, eloClassic: -1 });
PlayerProfileSchema.index({ 'stats.gamesPlayed': 1, eloTeams: -1 });

export const PlayerProfile = mongoose.model<IPlayerProfile>('PlayerProfile', PlayerProfileSchema);
