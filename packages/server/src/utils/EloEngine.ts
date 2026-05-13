// Standard Elo with pairwise comparison for multi-player games.
// Each pair (winner vs loser, winner vs middle, middle vs durak) is evaluated
// independently and contributions are averaged over (N-1) opponents so that
// total Elo movement stays proportional regardless of player count.

export type Placement = 'winner' | 'middle' | 'durak';

export interface EloPlayer {
  id: string;
  currentElo: number;
  gamesPlayed: number; // used to select K-factor
  placement: Placement;
}

function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < 20) return 40;
  if (gamesPlayed < 50) return 24;
  return 16;
}

function expected(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function placementScore(p: Placement): number {
  if (p === 'winner') return 1;
  if (p === 'durak') return 0;
  return 0.5;
}

/** Returns a map of player id → Elo delta (rounded to integer). */
export function calculateEloDeltas(players: EloPlayer[]): Map<string, number> {
  const deltas = new Map<string, number>(players.map((p) => [p.id, 0]));
  const n = players.length;
  if (n < 2) return deltas;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = players[i];
      const b = players[j];

      // Draws between two middle-placed players — no Elo movement.
      if (a.placement === 'middle' && b.placement === 'middle') continue;

      const sA = placementScore(a.placement);
      const sB = placementScore(b.placement);
      const eA = expected(a.currentElo, b.currentElo);
      const eB = expected(b.currentElo, a.currentElo);

      // Divide by (n-1) so total swing ≈ one full K regardless of player count.
      deltas.set(a.id, deltas.get(a.id)! + (kFactor(a.gamesPlayed) * (sA - eA)) / (n - 1));
      deltas.set(b.id, deltas.get(b.id)! + (kFactor(b.gamesPlayed) * (sB - eB)) / (n - 1));
    }
  }

  // Round to integers
  deltas.forEach((v, k) => deltas.set(k, Math.round(v)));
  return deltas;
}
