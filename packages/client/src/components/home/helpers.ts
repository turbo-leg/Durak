export type SheetKey = 'ranked' | 'custom' | 'solo' | null;

export interface RankedOptions {
  mode: 'classic' | 'teams';
  maxPlayers: number;
  handSize: number;
}

export type HomeState = 'home' | 'searching';

export function getAvailablePlayers(mode: string) {
  return mode === 'teams' ? [4, 6] : [2, 3, 4, 5, 6];
}

export function getAvailableHandSizes(mode: string, players: number) {
  if (mode === 'teams') return players === 4 ? [7] : [5];
  return players <= 4 ? [5, 7] : [5];
}

export const FLOATING_CARDS = [
  { suit: '♠', rank: 'A', delay: 0.05, x: 4, rotate: -22, scale: 0.85 },
  { suit: '♥', rank: 'K', delay: 0.15, x: 14, rotate: -10, scale: 0.95 },
  { suit: '♦', rank: 'Q', delay: 0.1, x: 24, rotate: 4, scale: 0.9 },
  { suit: '♣', rank: 'J', delay: 0.2, x: 70, rotate: -5, scale: 0.9 },
  { suit: '♥', rank: '7', delay: 0.12, x: 80, rotate: 12, scale: 0.95 },
  { suit: '♠', rank: 'A', delay: 0.07, x: 89, rotate: 24, scale: 0.85 },
];
