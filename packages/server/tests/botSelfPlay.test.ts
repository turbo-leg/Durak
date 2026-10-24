import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { ATTACK_MODEL_FEATURES, type BotAttackModel } from '../src/ai/BotAttackModel';
import { DUEL_LEARNED_ATTACK_MODEL } from '../src/ai/BotLearnedChampion';
import { DUEL_CHAMPION_POLICY } from '../src/ai/BotDuelChampion';
import { CHAMPION_POLICY } from '../src/ai/BotChampion';
import { BASELINE_POLICY, type BotPolicy } from '../src/ai/BotPolicy';
import { BotMatchPool } from './botMatchPool';
import { duelReward } from './botReward';

type Row = {
  id: string;
  generation: number;
  model: BotAttackModel;
  games: number;
  wins: number;
  pickups: number;
  reward: number;
  invalid: number;
  stalled: number;
};

const duel = DUEL_CHAMPION_POLICY;
const opponents: BotPolicy[] = [
  duel,
  BASELINE_POLICY,
  CHAMPION_POLICY,
  { ...duel, id: 'mass-tempo', exploreMass: true, massBonus: 2.5, attackCostScale: 0.5 },
  { ...duel, id: 'conserve-power', trumpCost: 1.6, jokerCost: 1.5, attackCostScale: 1.3 },
];

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => (value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function normal(random: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
}

async function evaluate(
  pool: BotMatchPool,
  model: BotAttackModel,
  generation: number,
  seeds: number,
  offset: number,
  previous: BotAttackModel | null,
): Promise<Row> {
  const row: Row = {
    id: model.id,
    generation,
    model,
    games: 0,
    wins: 0,
    pickups: 0,
    reward: 0,
    invalid: 0,
    stalled: 0,
  };
  for (let start = 0; start < seeds; start += 250) {
    const matches = [];
    for (let seed = start; seed < Math.min(seeds, start + 250); seed++) {
      const opponent = opponents[seed % opponents.length]!;
      for (let seat = 0; seat < 2; seat++)
        matches.push({
          seed: offset + seed,
          seat,
          policy: duel,
          options: {
            players: 2,
            incumbent: opponent,
            candidateModel: model,
            incumbentModel: seed % opponents.length === 0 ? previous : null,
          },
        });
    }
    for (const [index, game] of (await pool.run(matches)).entries()) {
      const seat = matches[index]!.seat;
      row.games++;
      row.wins += Number(game.winner === seat);
      row.pickups += game.pickupsBySeat[seat] ?? 0;
      row.reward += duelReward(game, seat);
      row.invalid += Number(game.invalid);
      row.stalled += Number(game.stalled);
    }
    if (model.id === `g${generation}-incumbent` && (start + 250) % 1000 === 0)
      process.stdout.write(
        `Generation ${generation}: ${Math.min(seeds, start + 250)}/${seeds} seed pairs per candidate\n`,
      );
  }
  return row;
}

async function readiness(pool: BotMatchPool, model: BotAttackModel | null, seedBase: number) {
  const styles = opponents.slice(1);
  const summaries = await Promise.all(
    styles.map(async (opponent, style) => {
      const matches = [];
      for (let seed = 0; seed < 200; seed++)
        for (let seat = 0; seat < 2; seat++)
          matches.push({
            seed: seedBase + style * 200 + seed,
            seat,
            policy: duel,
            options: { players: 2, incumbent: opponent, candidateModel: model },
          });
      const results = await pool.run(matches);
      return {
        opponent: opponent.id,
        wins: results.reduce((sum, game, index) => sum + Number(game.winner === index % 2), 0),
        games: results.length,
        invalid: results.filter((game) => game.invalid).length,
        stalled: results.filter((game) => game.stalled).length,
      };
    }),
  );
  return summaries;
}

describe.skipIf(process.env.BOT_SELFPLAY_RUN !== '1')('outcome-trained duel attack model', () => {
  it('trains by self-play and promotes only after fresh win-based checks', async () => {
    const generations = Number(process.env.BOT_SELFPLAY_GENERATIONS ?? '4');
    const population = Number(process.env.BOT_SELFPLAY_POPULATION ?? '16');
    const seeds = Number(process.env.BOT_SELFPLAY_SEEDS ?? '80');
    const holdoutSeeds = Number(process.env.BOT_SELFPLAY_HOLDOUT ?? '500');
    const workers = Number(process.env.BOT_SELFPLAY_WORKERS ?? '4');
    const seedBase = Number(process.env.BOT_SELFPLAY_SEED_BASE ?? '20000000');
    expect(generations).toBeGreaterThan(0);
    expect(population).toBeGreaterThanOrEqual(4);
    expect(seeds).toBeGreaterThan(0);
    expect(holdoutSeeds).toBeGreaterThan(0);
    const trainingStride = Math.max(100000, seeds);
    const holdoutBase = seedBase + generations * trainingStride;
    const readinessBase = holdoutBase + holdoutSeeds;
    const random = seededRandom(seedBase ^ 0x5e1f);
    const zero = Array.from({ length: ATTACK_MODEL_FEATURES.length }, () => 0);
    const candidatePath = resolve(process.cwd(), 'output/bot-selfplay/candidate.json');
    const previousCandidate = existsSync(candidatePath)
      ? (JSON.parse(readFileSync(candidatePath, 'utf8')) as BotAttackModel)
      : null;
    const startingModel = DUEL_LEARNED_ATTACK_MODEL ?? previousCandidate;
    if (startingModel) expect(startingModel.weights).toHaveLength(ATTACK_MODEL_FEATURES.length);
    let mean = startingModel ? [...startingModel.weights] : [...zero];
    let spread = 35;
    let best: BotAttackModel = startingModel ?? { id: 'untrained', weights: zero };
    const rows: Row[] = [];
    const directory = resolve(process.cwd(), 'output/bot-selfplay');
    mkdirSync(directory, { recursive: true });
    const pool = new BotMatchPool(workers);
    try {
      for (let generation = 0; generation < generations; generation++) {
        const models: BotAttackModel[] = [
          { ...best, id: `g${generation}-incumbent` },
          { id: `g${generation}-mean`, weights: [...mean] },
        ];
        for (let index = models.length; index < population; index++)
          models.push({
            id: `g${generation}-sample${index}`,
            weights: mean.map((weight) =>
              Math.max(-120, Math.min(120, weight + normal(random) * spread)),
            ),
          });
        const results = await Promise.all(
          models.map((model) =>
            evaluate(pool, model, generation, seeds, seedBase + generation * trainingStride, best),
          ),
        );
        rows.push(...results);
        results.sort((a, b) => b.reward / b.games - a.reward / a.games);
        const elites = results.slice(0, 4);
        best = { ...elites[0]!.model, id: `generation-${generation}-best` };
        mean = mean.map(
          (_, feature) =>
            elites.reduce((sum, row) => sum + row.model.weights[feature]!, 0) / elites.length,
        );
        process.stdout.write(
          `Generation ${generation}: ${elites[0]!.wins}/${elites[0]!.games} wins, reward ${(elites[0]!.reward / elites[0]!.games).toFixed(3)}\n`,
        );
        writeFileSync(
          resolve(directory, 'progress.json'),
          JSON.stringify(
            {
              seedBase,
              generations,
              population,
              seeds,
              completedGenerations: generation + 1,
              completedTrainingGames: rows.reduce((sum, row) => sum + row.games, 0),
              best,
              rows,
            },
            null,
            2,
          ),
        );
        spread *= 0.8;
      }

      const holdout = await Promise.all(
        Array.from({ length: holdoutSeeds }, (_, seed) =>
          pool.run(
            [0, 1].map((seat) => ({
              seed: holdoutBase + seed,
              seat,
              policy: duel,
              options: {
                players: 2,
                incumbent: duel,
                candidateModel: best,
                incumbentModel: DUEL_LEARNED_ATTACK_MODEL,
              },
            })),
          ),
        ),
      );
      const blocks = holdout.map((games, seed) => ({
        seed: holdoutBase + seed,
        candidateWins: games.filter((game, seat) => game.winner === seat).length,
        incumbentWins: games.filter((game, seat) => game.winner !== seat).length,
        invalid: games.some((game) => game.invalid || game.stalled),
      }));
      const differences = blocks.map((block) => (block.candidateWins - block.incumbentWins) / 2);
      const lift =
        differences.reduce((sum, difference) => sum + difference, 0) / differences.length;
      const variance =
        differences.reduce((sum, difference) => sum + (difference - lift) ** 2, 0) /
        Math.max(1, differences.length - 1);
      const lowerBound = lift - 1.96 * Math.sqrt(variance / differences.length);
      const [candidateReadiness, incumbentReadiness] = await Promise.all([
        readiness(pool, best, readinessBase),
        readiness(pool, DUEL_LEARNED_ATTACK_MODEL, readinessBase),
      ]);
      const promoted =
        holdoutSeeds >= 500 &&
        lowerBound > 0 &&
        blocks.every((block) => !block.invalid) &&
        rows.every((row) => row.invalid === 0 && row.stalled === 0) &&
        candidateReadiness.every(
          (row) => row.invalid === 0 && row.stalled === 0 && row.wins / row.games >= 0.5,
        );
      mkdirSync(resolve(directory, 'runs'), { recursive: true });
      const result = {
        generatedAt: new Date().toISOString(),
        seedBase,
        trainingStride,
        holdoutBase,
        readinessBase,
        generations,
        population,
        seeds,
        holdoutSeeds,
        featureNames: ATTACK_MODEL_FEATURES,
        startedFrom: startingModel?.id ?? null,
        rows,
        model: best,
        holdout: blocks,
        lift,
        lowerBound,
        candidateReadiness,
        incumbentReadiness,
        promoted,
        totalGames:
          rows.reduce((sum, row) => sum + row.games, 0) +
          holdoutSeeds * 2 +
          candidateReadiness.reduce((sum, row) => sum + row.games, 0) +
          incumbentReadiness.reduce((sum, row) => sum + row.games, 0),
      };
      writeFileSync(resolve(directory, 'results.json'), JSON.stringify(result, null, 2));
      writeFileSync(resolve(directory, 'candidate.json'), JSON.stringify(best, null, 2));
      writeFileSync(
        resolve(directory, 'runs', `${result.generatedAt.replaceAll(':', '-')}.json`),
        JSON.stringify(result, null, 2),
      );
      const historyPath = resolve(directory, 'history.json');
      const history = existsSync(historyPath)
        ? (JSON.parse(readFileSync(historyPath, 'utf8')) as Array<Record<string, unknown>>)
        : [];
      history.push({
        generatedAt: result.generatedAt,
        seedBase,
        totalGames: result.totalGames,
        lift,
        lowerBound,
        promoted,
      });
      writeFileSync(historyPath, JSON.stringify(history, null, 2));
      if (promoted && process.env.BOT_SELFPLAY_PROMOTE === '1') {
        const champion = { ...best, id: 'duel-learned' };
        writeFileSync(
          resolve(process.cwd(), 'packages/server/src/ai/BotLearnedChampion.ts'),
          await format(
            `import type { BotAttackModel } from './BotAttackModel';\n\n// Promoted by outcome-only self-play after fresh holdout and stress evaluation.\nexport const DUEL_LEARNED_ATTACK_MODEL: BotAttackModel | null = ${JSON.stringify(champion, null, 2)};\n`,
            { parser: 'typescript', singleQuote: true, trailingComma: 'all', printWidth: 100 },
          ),
        );
      }
      process.stdout.write(
        `Self-play holdout: lift ${(100 * lift).toFixed(2)} points, lower bound ${(100 * lowerBound).toFixed(2)}, promoted=${promoted}, games=${result.totalGames}\n`,
      );
      expect(blocks.every((block) => !block.invalid)).toBe(true);
    } finally {
      await pool.close();
    }
  }, 7200000);
});
