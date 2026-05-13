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
