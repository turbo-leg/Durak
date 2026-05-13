export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_win', name: 'First Blood', emoji: '🏆', description: 'Win your first game' },
  {
    id: 'survivor_5',
    name: 'Survivor',
    emoji: '🛡️',
    description: 'Survive 5 games without being durak',
  },
  { id: 'durak_free', name: 'Clean Streak', emoji: '✨', description: 'Win 3 games in a row' },
  { id: 'veteran', name: 'Veteran', emoji: '⚔️', description: 'Play 50 games' },
  { id: 'champion', name: 'Champion', emoji: '👑', description: 'Reach 1200 ELO' },
];

export function evaluateBadges(
  profile: {
    stats: { wins: number; gamesPlayed: number };
    eloClassic: number;
    badges: string[];
  },
  _isWinner: boolean,
): string[] {
  const earned: string[] = [];
  const has = (id: string) => profile.badges.includes(id);

  if (!has('first_win') && profile.stats.wins >= 1) earned.push('first_win');
  if (!has('veteran') && profile.stats.gamesPlayed >= 50) earned.push('veteran');
  if (!has('champion') && profile.stats.eloClassic >= 1200) earned.push('champion');
  // survivor_5 and durak_free require streak tracking — skip for now, add in v1.1

  return earned;
}
