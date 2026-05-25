import { PlayerProfile } from '../models/PlayerProfile';
import { CoinTransaction, type CoinReason } from '../models/CoinTransaction';
import mongoose from 'mongoose';

export const COIN_REWARDS = {
  WIN: 50,
  LOSE_CONSOLATION: 10,
  FIRST_GAME_OF_DAY: 25,
  DAILY_LOGIN: 15,
  RANK_UP: 100,
} as const;

/** Returns true if `date` is the same calendar day as today (UTC). */
export function isSameUTCDay(date: Date | null, now: Date): boolean {
  if (!date) return false;
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

/**
 * Atomically credits `amount` coins to a profile and appends an audit record.
 * Safe to call from concurrent game-over handlers.
 */
export async function awardCoins(
  profileId: mongoose.Types.ObjectId,
  amount: number,
  reason: CoinReason,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await Promise.all([
    PlayerProfile.findByIdAndUpdate(profileId, { $inc: { coins: amount } }),
    CoinTransaction.create({ playerId: profileId, amount, reason, metadata }),
  ]);
}
