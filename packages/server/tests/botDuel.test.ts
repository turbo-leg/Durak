import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { BASELINE_POLICY, BotPolicy } from '../src/ai/BotPolicy';
import { CHAMPION_POLICY } from '../src/ai/BotChampion';
import { DUEL_CHAMPION_POLICY } from '../src/ai/BotDuelChampion';
import { BotMatchPool } from './botMatchPool';
import { successiveHalving, type TrainingRow } from './botSuccessiveHalving';
import { duelReward } from './botReward';

type Row = TrainingRow;

function openingCandidates(): BotPolicy[] {
  const c = DUEL_CHAMPION_POLICY;
  return [
    { ...c, id: 'duel-champion' },
    { ...CHAMPION_POLICY, id: 'ffa-champion' },
    { ...c, id: 'conserve-power', trumpCost: 1.6, jokerCost: 1.5, attackCostScale: 1.3 },
    { ...c, id: 'shed-fast', attackCostScale: 0.4, endgameDump: 3 },
    { ...c, id: 'attack-pressure', attackPressure: 1.8, attackCostScale: 0.7 },
    { ...c, id: 'mass-tempo', exploreMass: true, massBonus: 2.2, attackCostScale: 0.7 },
    { ...c, id: 'mass-averse', massBonus: 0.2 },
    { ...c, id: 'finish-now', finishWinBonus: 1000 },
    { ...c, id: 'finish-now-save', finishWinBonus: 1000, trumpCost: 1.6 },
    { ...c, id: 'endgame-rush', endgameDump: 5, attackCostScale: 0.7 },
    { ...c, id: 'forward-strong', exploreDefense: true, defensePressure: 3 },
    {
      ...c,
      id: 'balanced',
      attackCostScale: 0.7,
      attackPressure: 1.3,
      endgameDump: 3,
      massBonus: 1.3,
    },
    { ...c, id: 'card-count-20', forcePickupWeight: 20 },
    { ...c, id: 'card-count-50', forcePickupWeight: 50 },
    { ...c, id: 'card-count-90', forcePickupWeight: 90 },
    { ...c, id: 'card-count-rush', forcePickupWeight: 50, attackCostScale: 0.6, endgameDump: 3 },
    { ...c, id: 'belief-low', forcePickupWeight: 20 },
    { ...c, id: 'belief-high', forcePickupWeight: 110 },
    { ...c, id: 'belief-mass', forcePickupWeight: 75, exploreMass: true, massBonus: 1.5 },
    { ...c, id: 'trump-gambit', trumpCost: 0.25, attackCostScale: 0.5 },
    { ...c, id: 'early-saver', trumpCost: 1.45, jokerCost: 1.4 },
    { ...c, id: 'late-power-half', endgamePowerDiscount: 0.5 },
    { ...c, id: 'late-power-free', endgamePowerDiscount: 0.05 },
    { ...c, id: 'late-power-plus', endgamePowerDiscount: 0.5, forcePickupWeight: 80 },
    { ...c, id: 'late-power-conserve', endgamePowerDiscount: 0.5, trumpCost: 1.4 },
    { ...c, id: 'low-lead', attackPressure: 0.1, earlyAttackPressure: 0.1 },
    {
      ...c,
      id: 'low-lead-rush',
      attackPressure: 0.1,
      earlyAttackPressure: 0.1,
      attackCostScale: 0.6,
    },
    { ...c, id: 'medium-lead', attackPressure: 0.5, earlyAttackPressure: 0.5 },
    { ...c, id: 'adaptive-lead', earlyAttackPressure: 0.1, attackPressure: 1 },
    { ...c, id: 'early-low-late-high', earlyAttackPressure: 0.1, attackPressure: 2 },
    { ...c, id: 'zero-lead', attackPressure: 0, earlyAttackPressure: 0 },
    { ...c, id: 'negative-lead', attackPressure: -0.4, earlyAttackPressure: -0.4 },
    { ...c, id: 'early-negative', attackPressure: 0.1, earlyAttackPressure: -0.7 },
    { ...c, id: 'late-moderate', attackPressure: 0.6, earlyAttackPressure: 0 },
    { ...c, id: 'zero-lead-save', attackPressure: 0, earlyAttackPressure: 0, trumpCost: 1.4 },
  ];
}

function children(rows: Row[]): BotPolicy[] {
  const leaders = [...rows]
    .filter((row) => row.id !== 'duel-champion')
    .sort((a, b) => (b.reward ?? 0) / b.games - (a.reward ?? 0) / a.games)
    .slice(0, 2);
  const out = [{ ...DUEL_CHAMPION_POLICY, id: 'duel-champion-g1' }];
  for (const leader of leaders) {
    for (const [key, shift] of [
      ['attackCostScale', -0.3],
      ['trumpCost', 0.4],
      ['attackPressure', 0.4],
      ['massBonus', -0.4],
      ['endgameDump', 1.5],
    ] as const) {
      out.push({
        ...leader.policy,
        id: `${leader.id}-${key}`,
        [key]: Math.max(0.1, Math.min(7, leader.policy[key] + shift)),
      });
    }
    out.push({
      ...leader.policy,
      id: `${leader.id}-belief-up`,
      forcePickupWeight: (leader.policy.forcePickupWeight ?? 0) + 30,
    });
    out.push({
      ...leader.policy,
      id: `${leader.id}-belief-down`,
      forcePickupWeight: Math.max(0, (leader.policy.forcePickupWeight ?? 0) - 30),
    });
    out.push({
      ...leader.policy,
      id: `${leader.id}-mass-options`,
      exploreMass: true,
    });
    out.push({
      ...leader.policy,
      id: `${leader.id}-late-power`,
      endgamePowerDiscount: 0.4,
    });
    out.push({
      ...leader.policy,
      id: `${leader.id}-early-low`,
      earlyAttackPressure: 0.1,
    });
    out.push({
      ...leader.policy,
      id: `${leader.id}-pressure-down`,
      attackPressure: leader.policy.attackPressure - 0.3,
      earlyAttackPressure:
        (leader.policy.earlyAttackPressure ?? leader.policy.attackPressure) - 0.3,
    });
  }
  return out;
}

async function evaluate(
  pool: BotMatchPool,
  policy: BotPolicy,
  generation: number,
  start: number,
  end: number,
  offset: number,
): Promise<Row> {
  const row: Row = {
    id: policy.id,
    generation,
    policy,
    games: 0,
    wins: 0,
    stalled: 0,
    invalid: 0,
    actions: 0,
    seatWins: [0, 0],
    reward: 0,
    pickups: 0,
  };
  const opponents = [
    DUEL_CHAMPION_POLICY,
    BASELINE_POLICY,
    CHAMPION_POLICY,
    openingCandidates()[5]!,
    openingCandidates()[2]!,
  ];
  const matches = [];
  for (let seed = start; seed < end; seed++) {
    for (let seat = 0; seat < 2; seat++) {
      const incumbent = opponents[seed % opponents.length]!;
      matches.push({
        seed: offset + seed,
        seat,
        policy,
        options: { players: 2, incumbent },
      });
    }
  }
  for (const [index, game] of (await pool.run(matches)).entries()) {
    const seat = matches[index]!.seat;
    row.games++;
    row.wins += Number(game.winner === seat);
    row.seatWins[seat]! += Number(game.winner === seat);
    row.stalled += Number(game.stalled);
    row.invalid += Number(game.invalid);
    row.actions += game.actions;
    row.reward! += duelReward(game, seat);
    row.pickups! += game.pickupsBySeat[seat] ?? 0;
  }
  return row;
}

async function readinessFor(
  pool: BotMatchPool,
  policy: BotPolicy,
  seedBase: number,
  label: string,
) {
  const readiness: Array<{ opponent: string; wins: number; games: number; stalled: number }> = [];
  const opponents = [
    BASELINE_POLICY,
    CHAMPION_POLICY,
    openingCandidates()[5]!,
    openingCandidates()[2]!,
  ];
  const results = await Promise.all(
    opponents.map((opponent, index) => {
      const matches = [];
      for (let seed = 0; seed < 200; seed++)
        for (let seat = 0; seat < 2; seat++)
          matches.push({
            seed: seedBase + 300000 + index * 10000 + seed,
            seat,
            policy,
            options: { players: 2, incumbent: opponent },
          });
      return pool.run(matches);
    }),
  );
  for (const [index, opponent] of opponents.entries()) {
    const summary = { opponent: opponent.id, wins: 0, games: 0, stalled: 0 };
    for (const [gameIndex, game] of results[index]!.entries()) {
      const seat = gameIndex % 2;
      summary.games++;
      summary.wins += Number(game.winner === seat);
      summary.stalled += Number(game.stalled || game.invalid);
    }
    readiness.push(summary);
    process.stdout.write(
      `${label} vs ${summary.opponent}: ${summary.wins}/${summary.games}, ${summary.stalled} stalls\n`,
    );
  }
  return readiness;
}

describe.skipIf(process.env.BOT_DUEL_RUN !== '1')('one-on-one bot lab', () => {
  it('selects a duel specialist on fresh, seat-swapped games', async () => {
    const seeds = Number(process.env.BOT_DUEL_SEEDS ?? '80');
    const holdoutSeeds = Number(process.env.BOT_DUEL_HOLDOUT ?? '300');
    const seedBase = Number(process.env.BOT_DUEL_SEED_BASE ?? '500000');
    const workers = Number(process.env.BOT_DUEL_WORKERS ?? '4');
    expect(seeds).toBeGreaterThan(0);
    expect(holdoutSeeds).toBeGreaterThan(0);
    const pool = new BotMatchPool(workers);
    try {
      const first = await successiveHalving(openingCandidates(), seeds, (policy, start, end) =>
        evaluate(pool, policy, 0, start, end, seedBase),
      );
      const second = await successiveHalving(
        children(first.finalists),
        seeds,
        (policy, start, end) => evaluate(pool, policy, 1, start, end, seedBase + 100000),
      );
      const rows = [...first.rows, ...second.rows];
      const finalist = [...first.finalists, ...second.finalists]
        .filter((row) => row.id !== 'duel-champion' && row.id !== 'duel-champion-g1')
        .sort((a, b) => (b.reward ?? 0) / b.games - (a.reward ?? 0) / a.games)[0]!;
      const holdout: Array<{ seed: number; candidateWins: number; championWins: number }> = [];
      const holdoutResults = await Promise.all(
        Array.from({ length: holdoutSeeds }, (_, seed) =>
          pool.run(
            [0, 1].map((seat) => ({
              seed: seedBase + 200000 + seed,
              seat,
              policy: finalist.policy,
              options: { players: 2, incumbent: DUEL_CHAMPION_POLICY },
            })),
          ),
        ),
      );
      for (let seed = 0; seed < holdoutSeeds; seed++) {
        let candidateWins = 0;
        let championWins = 0;
        for (let seat = 0; seat < 2; seat++) {
          const game = holdoutResults[seed]![seat]!;
          expect(game.invalid || game.stalled).toBe(false);
          candidateWins += Number(game.winner === seat);
          championWins += Number(game.winner !== seat);
        }
        holdout.push({ seed, candidateWins, championWins });
      }
      // Paired two-seat seed blocks. Lift is candidate win rate minus incumbent win rate.
      const differences = holdout.map((row) => (row.candidateWins - row.championWins) / 2);
      const lift = differences.reduce((a, b) => a + b, 0) / differences.length;
      const variance =
        differences.reduce((a, b) => a + (b - lift) ** 2, 0) / Math.max(1, differences.length - 1);
      const lowerBound = lift - 1.96 * Math.sqrt(variance / differences.length);
      const finalistReadiness = await readinessFor(pool, finalist.policy, seedBase, 'Finalist');
      const robust = finalistReadiness.every(
        (row) => row.stalled === 0 && row.wins / row.games >= 0.5,
      );
      const promoted =
        lowerBound > 0 && robust && rows.every((row) => row.invalid === 0 && row.stalled === 0);
      const readiness = promoted
        ? finalistReadiness
        : await readinessFor(pool, DUEL_CHAMPION_POLICY, seedBase, 'Champion');
      const dir = resolve(process.cwd(), 'output/bot-duel');
      const runs = resolve(dir, 'runs');
      mkdirSync(runs, { recursive: true });
      const result = {
        generatedAt: new Date().toISOString(),
        players: 2,
        seedBase,
        seeds,
        holdoutSeeds,
        rows,
        trainingStages: { generation0: first.stages, generation1: second.stages },
        finalist: finalist.id,
        holdout,
        lift,
        lowerBound,
        promoted,
        readiness,
        finalistReadiness,
      };
      writeFileSync(resolve(dir, 'results.json'), JSON.stringify(result, null, 2));
      const historyPath = resolve(dir, 'history.json');
      const history = existsSync(historyPath)
        ? (JSON.parse(readFileSync(historyPath, 'utf8')) as Array<Record<string, unknown>>)
        : [];
      history.push({
        generatedAt: result.generatedAt,
        games:
          rows.reduce((sum, row) => sum + row.games, 0) +
          holdoutSeeds * 2 +
          readiness.reduce((sum, row) => sum + row.games, 0) +
          (promoted ? 0 : finalistReadiness.reduce((sum, row) => sum + row.games, 0)),
        finalist: result.finalist,
        lift,
        lowerBound,
        promoted,
      });
      writeFileSync(historyPath, JSON.stringify(history, null, 2));
      writeFileSync(
        resolve(runs, `${result.generatedAt.replaceAll(':', '-')}.json`),
        JSON.stringify(result, null, 2),
      );
      if (promoted && process.env.BOT_DUEL_PROMOTE === '1') {
        const winner = { ...finalist.policy, id: 'duel-champion' };
        writeFileSync(
          resolve(process.cwd(), 'packages/server/src/ai/BotDuelChampion.ts'),
          await format(
            `import { BotPolicy } from './BotPolicy';\n\n// Promoted by the one-on-one bot lab after holdout evaluation.\nexport const DUEL_CHAMPION_POLICY: BotPolicy = ${JSON.stringify(winner, null, 2)};\n`,
            { parser: 'typescript', singleQuote: true, trailingComma: 'all', printWidth: 100 },
          ),
        );
      }
      process.stdout.write(
        `Duel holdout: ${finalist.id}, lift ${(lift * 100).toFixed(2)} points, lower bound ${(lowerBound * 100).toFixed(2)}, promoted=${promoted}\n`,
      );
      expect(rows.every((row) => row.invalid === 0 && row.stalled === 0)).toBe(true);
    } finally {
      await pool.close();
    }
  }, 600000);
});
