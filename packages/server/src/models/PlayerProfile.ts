import mongoose from 'mongoose';

export interface IPlayerProfile extends mongoose.Document {
  discordId: string;
  username: string;
  avatarUrl: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    durakCount: number;
  };
  updatedAt: Date;
}

const PlayerProfileSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      durakCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export const PlayerProfile = mongoose.model<IPlayerProfile>('PlayerProfile', PlayerProfileSchema);
