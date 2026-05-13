import mongoose from 'mongoose';

export interface IPlayerProfile extends mongoose.Document {
  discordId: string;
  userId: string; // internal user ID for email/password accounts
  username: string;
  avatarUrl: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    durakCount: number;
  };
  eloClassic: number;
  eloTeams: number;
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
    },
    eloClassic: { type: Number, default: 1000 },
    eloTeams: { type: Number, default: 1000 },
  },
  { timestamps: true },
);

// Compound indexes to cover leaderboard query: filter by gamesPlayed, sort by elo
PlayerProfileSchema.index({ 'stats.gamesPlayed': 1, eloClassic: -1 });
PlayerProfileSchema.index({ 'stats.gamesPlayed': 1, eloTeams: -1 });

export const PlayerProfile = mongoose.model<IPlayerProfile>('PlayerProfile', PlayerProfileSchema);
