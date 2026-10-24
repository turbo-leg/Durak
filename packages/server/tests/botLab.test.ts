import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { BASELINE_POLICY, BotPolicy } from '../src/ai/BotPolicy';
import { CHAMPION_POLICY } from '../src/ai/BotChampion';
import { BotMatchPool } from './botMatchPool';
import { successiveHalving, type TrainingRow } from './botSuccessiveHalving';

type Result = TrainingRow;

const MASS_SPECIALIST: BotPolicy = {
  ...CHAMPION_POLICY,
  id: 'mass-specialist',
  exploreMass: true,
  massBonus: 2.5,
  attackCostScale: 0.5,
};
const POWER_CONSERVER: BotPolicy = {
  ...CHAMPION_POLICY,
  id: 'power-conserver',
  trumpCost: 1.6,
  jokerCost: 1.5,
  attackCostScale: 1.3,
};

function opponentsForSeed(seed: number): BotPolicy[] {
  switch (seed % 4) {
    case 0:
      return [CHAMPION_POLICY];
    case 1:
      return [CHAMPION_POLICY, BASELINE_POLICY, MASS_SPECIALIST, POWER_CONSERVER];
    case 2:
      return [MASS_SPECIALIST, POWER_CONSERVER];
    default:
      return [BASELINE_POLICY, CHAMPION_POLICY, POWER_CONSERVER, MASS_SPECIALIST];
  }
}

function variants(champion: BotPolicy): BotPolicy[] {
  return [
    { ...champion, id: 'champion' },
    { ...BASELINE_POLICY, id: 'baseline' },
    { ...champion, id: 'card-conservation', trumpCost: 1.45, jokerCost: 1.3 },
    { ...champion, id: 'attack-pressure', attackPressure: 1.55, trumpCost: 0.8 },
    { ...champion, id: 'mass-options', exploreMass: true, massBonus: 1.35 },
    { ...champion, id: 'defense-pressure', exploreDefense: true, defensePressure: 1.45 },
    { ...champion, id: 'endgame-dump', endgameDump: 2.2, massBonus: 1.2 },
    {
      ...champion,
      id: 'balanced',
      exploreMass: true,
      exploreDefense: true,
      attackPressure: 1.25,
      massBonus: 1.2,
      endgameDump: 1.5,
      defensePressure: 1.2,
    },
    { ...champion, id: 'shed-fast', attackCostScale: 0.3, endgameDump: 2.5, trumpCost: 0.55 },
    { ...champion, id: 'mass-averse', massBonus: 0.1, attackCostScale: 1.2 },
    { ...champion, id: 'mass-tempo', exploreMass: true, massBonus: 2.5, attackCostScale: 0.5 },
    { ...champion, id: 'finish-now', exploreMass: true, finishWinBonus: 1000 },
    {
      ...champion,
      id: 'finish-fast',
      exploreMass: true,
      finishWinBonus: 1000,
      attackCostScale: 0.5,
    },
    { ...champion, id: 'forward-strong', exploreDefense: true, defensePressure: 3 },
    { ...champion, id: 'endgame-urgent', endgameDump: 5, attackCostScale: 0.4 },
  ];
}

function children(parents: Result[]): BotPolicy[] {
  const best = [...parents]
    .filter((r) => r.id !== 'baseline')
    .sort((a, b) => b.wins - a.wins || a.stalled - b.stalled)
    .slice(0, 2);
  const knobs: Array<
    keyof Pick<
      BotPolicy,
      'trumpCost' | 'attackCostScale' | 'massBonus' | 'endgameDump' | 'defensePressure'
    >
  > = ['trumpCost', 'attackCostScale', 'massBonus', 'endgameDump', 'defensePressure'];
  const out: BotPolicy[] = [{ ...CHAMPION_POLICY, id: 'champion-g1' }];
  for (const parent of best) {
    for (const [i, knob] of knobs.entries()) {
      const delta = i % 2 ? 0.35 : -0.25;
      out.push({
        ...parent.policy,
        id: `${parent.id}-${knob}-${delta > 0 ? 'up' : 'down'}`,
        [knob]: Math.max(0.15, Math.min(3, parent.policy[knob] + delta)),
      });
    }
  }
  return out;
}

async function evaluate(
  pool: BotMatchPool,
  policy: BotPolicy,
  generation: number,
  start: number,
  end: number,
  seedOffset: number,
): Promise<Result> {
  const row: Result = {
    id: policy.id,
    generation,
    policy,
    games: 0,
    wins: 0,
    stalled: 0,
    invalid: 0,
    actions: 0,
    seatWins: [0, 0, 0, 0, 0, 0],
  };
  const matches = [];
  for (let seed = start; seed < end; seed++) {
    for (let seat = 0; seat < 6; seat++) {
      matches.push({
        seed: seedOffset + seed,
        seat,
        policy,
        options: { opponents: opponentsForSeed(seed) },
      });
    }
  }
  for (const [index, outcome] of (await pool.run(matches)).entries()) {
    const seat = matches[index]!.seat;
    row.games++;
    row.actions += outcome.actions;
    if (outcome.winner === seat) {
      row.wins++;
      row.seatWins[seat]!++;
    }
    if (outcome.stalled) row.stalled++;
    if (outcome.invalid) row.invalid++;
  }
  return row;
}

describe.skipIf(process.env.BOT_LAB_RUN !== '1')('six-player bot lab', () => {
  it('plays seeded, seat-rotated tournaments and saves a report', async () => {
    const seeds = Number(process.env.BOT_LAB_SEEDS ?? '20');
    const holdoutSeeds = Number(process.env.BOT_LAB_HOLDOUT_SEEDS ?? '100');
    const seedBase = Number(process.env.BOT_LAB_SEED_BASE ?? '100000');
    expect(seeds).toBeGreaterThan(0);
    expect(holdoutSeeds).toBeGreaterThan(0);
    expect(seedBase).toBeGreaterThanOrEqual(0);
    const workers = Number(process.env.BOT_LAB_WORKERS ?? '4');
    const pool = new BotMatchPool(workers);
    try {
      const first = await successiveHalving(
        variants(CHAMPION_POLICY),
        seeds,
        (policy, start, end) => evaluate(pool, policy, 0, start, end, seedBase),
      );
      const second = await successiveHalving(
        children(first.finalists),
        seeds,
        (policy, start, end) => evaluate(pool, policy, 1, start, end, seedBase + 100000),
      );
      const rows = [...first.rows, ...second.rows];
      const finalist = [...first.finalists, ...second.finalists]
        .filter((r) => r.id !== 'champion' && r.id !== 'champion-g1' && r.id !== 'baseline')
        .sort((a, b) => b.wins / b.games - a.wins / a.games || a.stalled - b.stalled)[0]!;

      // Fresh seeds never used for selecting the finalist. Compare with the incumbent
      // in the same shuffled games and seat positions, then estimate uncertainty by seed.
      const holdout: Array<{ seed: number; candidateWins: number; championWins: number }> = [];
      const holdoutResults = await Promise.all(
        Array.from({ length: holdoutSeeds }, (_, seed) => {
          const matches = [];
          for (let seat = 0; seat < 6; seat++) {
            for (const policy of [finalist.policy, CHAMPION_POLICY])
              matches.push({
                seed: seedBase + 200000 + seed,
                seat,
                policy,
                options: { opponents: opponentsForSeed(seed) },
              });
          }
          return pool.run(matches);
        }),
      );
      for (let seed = 0; seed < holdoutSeeds; seed++) {
        let candidateWins = 0;
        let championWins = 0;
        for (let seat = 0; seat < 6; seat++) {
          const candidate = holdoutResults[seed]![seat * 2]!;
          const champion = holdoutResults[seed]![seat * 2 + 1]!;
          expect(
            candidate.invalid || candidate.stalled || champion.invalid || champion.stalled,
          ).toBe(false);
          if (candidate.winner === seat) candidateWins++;
          if (champion.winner === seat) championWins++;
        }
        holdout.push({ seed, candidateWins, championWins });
      }
      const differences = holdout.map((r) => (r.candidateWins - r.championWins) / 6);
      const lift = differences.reduce((a, b) => a + b, 0) / differences.length;
      const variance =
        differences.reduce((a, b) => a + (b - lift) ** 2, 0) / Math.max(1, differences.length - 1);
      const lowerBound = lift - 1.96 * Math.sqrt(variance / differences.length);
      const promoted =
        lowerBound > 0 && rows.every((row) => row.stalled === 0 && row.invalid === 0);
      const dir = resolve(process.cwd(), 'output/bot-lab');
      mkdirSync(dir, { recursive: true });
      const resultPath = resolve(dir, 'results.json');
      const historyPath = resolve(dir, 'history.json');
      const prior = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
      const history = existsSync(historyPath)
        ? (JSON.parse(readFileSync(historyPath, 'utf8')) as Array<Record<string, unknown>>)
        : [];
      const summarize = (result: {
        generatedAt: string;
        rows: Result[];
        holdoutSeeds: number;
        finalist: string;
        lift: number;
        lowerBound: number;
        promoted: boolean;
      }) => ({
        generatedAt: result.generatedAt,
        games: result.rows.reduce((sum, row) => sum + row.games, 0) + result.holdoutSeeds * 12,
        finalist: result.finalist,
        lift: result.lift,
        lowerBound: result.lowerBound,
        promoted: result.promoted,
      });
      if (prior && !history.some((entry) => entry.generatedAt === prior.generatedAt))
        history.push(summarize(prior));
      const result = {
        generatedAt: new Date().toISOString(),
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
      };
      writeFileSync(resultPath, JSON.stringify(result, null, 2));
      history.push(summarize(result));
      writeFileSync(historyPath, JSON.stringify(history, null, 2));
      const runsDir = resolve(dir, 'runs');
      mkdirSync(runsDir, { recursive: true });
      writeFileSync(
        resolve(runsDir, `${result.generatedAt.replaceAll(':', '-')}.json`),
        JSON.stringify(result, null, 2),
      );
      if (promoted && process.env.BOT_LAB_PROMOTE === '1') {
        const winner = { ...finalist.policy, id: 'champion' };
        writeFileSync(
          resolve(process.cwd(), 'packages/server/src/ai/BotChampion.ts'),
          await format(
            `import { BotPolicy } from './BotPolicy';\n\n// Promoted by the six-player bot lab after holdout evaluation.\nexport const CHAMPION_POLICY: BotPolicy = ${JSON.stringify(winner, null, 2)};\n`,
            { parser: 'typescript', singleQuote: true, trailingComma: 'all', printWidth: 100 },
          ),
        );
      }
      process.stdout.write(
        `Holdout: ${finalist.id}, lift ${(lift * 100).toFixed(2)} points, 95% lower bound ${(lowerBound * 100).toFixed(2)}, promoted=${promoted}\n`,
      );
      expect(rows.every((row) => row.invalid === 0)).toBe(true);
      expect(rows.every((row) => row.stalled === 0)).toBe(true);
    } finally {
      await pool.close();
    }
  }, 600000);
});
