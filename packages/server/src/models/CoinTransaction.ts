import mongoose from 'mongoose';

export type CoinReason =
  | 'win_bonus'
  | 'lose_consolation'
  | 'first_game_of_day'
  | 'daily_login'
  | 'rank_up'
  | 'iap'
  | 'purchase';

export interface ICoinTransaction extends mongoose.Document {
  playerId: mongoose.Types.ObjectId;
  amount: number; // positive = earn, negative = spend
  reason: CoinReason;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const CoinTransactionSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlayerProfile',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CoinTransaction = mongoose.model<ICoinTransaction>(
  'CoinTransaction',
  CoinTransactionSchema,
);
