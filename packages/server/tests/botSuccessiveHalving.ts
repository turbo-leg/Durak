import type { BotPolicy } from '../src/ai/BotPolicy';

export interface TrainingRow {
  id: string;
  generation: number;
  policy: BotPolicy;
  games: number;
  wins: number;
  stalled: number;
  invalid: number;
  actions: number;
  seatWins: number[];
  reward?: number;
  pickups?: number;
}

export interface TrainingStage {
  seeds: number;
  candidates: number;
}

function compare(a: TrainingRow, b: TrainingRow): number {
  return (
    (b.reward ?? 2 * b.wins - b.games) / b.games - (a.reward ?? 2 * a.wins - a.games) / a.games ||
    a.invalid - b.invalid ||
    a.stalled - b.stalled ||
    a.id.localeCompare(b.id)
  );
}

export async function successiveHalving(
  policies: BotPolicy[],
  seeds: number,
  evaluateRange: (policy: BotPolicy, start: number, end: number) => Promise<TrainingRow>,
): Promise<{ rows: TrainingRow[]; finalists: TrainingRow[]; stages: TrainingStage[] }> {
  if (!Number.isInteger(seeds) || seeds < 1) throw new Error('seeds must be positive');
  if (policies.length === 0) throw new Error('at least one policy is required');
  const boundaries = [...new Set([Math.ceil(seeds / 4), Math.ceil(seeds / 2), seeds])].sort(
    (a, b) => a - b,
  );
  const rows = new Map<string, TrainingRow>();
  const stages: TrainingStage[] = [];
  let active = policies;
  let start = 0;
  for (const [index, end] of boundaries.entries()) {
    const batches = await Promise.all(active.map((policy) => evaluateRange(policy, start, end)));
    for (const batch of batches) {
      const previous = rows.get(batch.id);
      if (!previous) {
        rows.set(batch.id, batch);
        continue;
      }
      previous.games += batch.games;
      previous.wins += batch.wins;
      previous.stalled += batch.stalled;
      previous.invalid += batch.invalid;
      previous.actions += batch.actions;
      if (batch.reward !== undefined) previous.reward = (previous.reward ?? 0) + batch.reward;
      if (batch.pickups !== undefined) previous.pickups = (previous.pickups ?? 0) + batch.pickups;
      previous.seatWins.forEach((_, seat) => {
        previous.seatWins[seat]! += batch.seatWins[seat] ?? 0;
      });
    }
    stages.push({ seeds: end, candidates: active.length });
    const ranked = active.map((policy) => rows.get(policy.id)!).sort(compare);
    if (index < boundaries.length - 1)
      active = ranked.slice(0, Math.max(2, Math.ceil(ranked.length / 2))).map((row) => row.policy);
    start = end;
  }
  return {
    rows: [...rows.values()],
    finalists: active.map((policy) => rows.get(policy.id)!).sort(compare),
    stages,
  };
}
