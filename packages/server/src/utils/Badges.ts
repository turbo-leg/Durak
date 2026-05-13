export { BADGES, type BadgeDef } from '@durak/shared';

export function evaluateBadges(
  profile: {
    stats: { wins: number; gamesPlayed: number; winStreak: number; durakFreeStreak: number };
    eloClassic: number;
    badges?: string[];
  },
  _isWinner: boolean,
): string[] {
  const earned: string[] = [];
  const has = (id: string) => profile.badges?.includes(id) ?? false;

  if (!has('first_win') && profile.stats.wins >= 1) earned.push('first_win');
  if (!has('veteran') && profile.stats.gamesPlayed >= 50) earned.push('veteran');
  if (!has('champion') && profile.eloClassic >= 1200) earned.push('champion');
  if (!has('survivor_5') && profile.stats.durakFreeStreak >= 5) earned.push('survivor_5');
  if (!has('durak_free') && profile.stats.winStreak >= 3) earned.push('durak_free');

  return earned;
}
