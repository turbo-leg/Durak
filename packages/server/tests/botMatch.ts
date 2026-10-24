import { GameState, Player } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { BotEngine } from '../src/ai/BotEngine';
import { BASELINE_POLICY, BotPolicy } from '../src/ai/BotPolicy';
import { CHAMPION_POLICY } from '../src/ai/BotChampion';
import type { BotAttackModel } from '../src/ai/BotAttackModel';

export interface MatchResult {
  winner: number;
  actions: number;
  stalled: boolean;
  invalid: boolean;
  pickupsBySeat: number[];
  finalHandBySeat: number[];
}

function rng(seed: number): () => number {
  let value = seed >>> 0;
  return () => (value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/** Plays through the real private-room handlers with timers and I/O disabled. */
export async function playBotMatch(
  seed: number,
  seat: number,
  candidate: BotPolicy,
  options: {
    players?: number;
    mixedOpponents?: boolean;
    incumbent?: BotPolicy;
    opponents?: BotPolicy[];
    candidateModel?: BotAttackModel | null;
    incumbentModel?: BotAttackModel | null;
  } = {},
): Promise<MatchResult> {
  const players = options.players ?? 6;
  const incumbent = options.incumbent ?? CHAMPION_POLICY;
  const random = rng(seed);
  const room = new DurakRoom();
  // Synthetic rooms are never registered with a Colyseus presence listing.
  // Disable Colyseus housekeeping for millions of headless matches.
  room.autoDispose = false;
  room.setPatchRate(null);
  room.state = new GameState();
  room.state.mode = 'classic';
  room.state.isPrivate = true;
  room.state.targetHandSize = 5;
  room.setGameRandom(random);
  room.broadcast = () => undefined;
  const internal = room as unknown as Record<string, (...args: unknown[]) => unknown>;
  internal.startTurnTimer = () => undefined;
  internal.scheduleBotTurn = () => undefined;
  internal.saveGameLog = () => Promise.resolve();
  for (let i = 0; i < players; i++) room.state.players.set(`p${i}`, new Player(`p${i}`));
  internal.startGame();
  const bots = Array.from({ length: players }, (_, i) => {
    const relativeSeat = (i - seat + players) % players;
    const policy =
      i === seat
        ? candidate
        : options.opponents?.length
          ? options.opponents[(relativeSeat - 1) % options.opponents.length]!
          : options.mixedOpponents && relativeSeat % 2 === 0
            ? BASELINE_POLICY
            : incumbent;
    return new BotEngine(
      policy,
      random,
      i === seat ? options.candidateModel : options.incumbentModel,
    );
  });
  let actions = 0;
  let invalid = false;
  const pickupsBySeat = Array.from({ length: players }, () => 0);
  while (room.state.phase === 'playing' && actions < 1500) {
    const id = room.state.currentTurn;
    const index = Number(id.slice(1));
    const move = await bots[index]!.think(room.state, id, 'hard', room.getOpponentResponseMemory());
    if (!move) {
      invalid = true;
      break;
    }
    const client = {
      sessionId: id,
      send: () => {
        invalid = true;
      },
    };
    if (move.action === 'attack') internal.handleAttack(client, { cards: move.cards });
    else if (move.action === 'defend') internal.handleDefend(client, { cards: move.cards });
    else if (move.action === 'pickup') internal.handlePickUp(client);
    else internal.handleSwapHuzur(client);
    actions++;
    if (!invalid && move.action === 'pickup') pickupsBySeat[index]!++;
    if (invalid) break;
  }
  const winner =
    room.state.phase === 'finished' && room.state.winners.length === 1
      ? Number(room.state.winners[0]!.slice(1))
      : -1;
  const finalHandBySeat = Array.from(
    { length: players },
    (_, i) => room.state.players.get(`p${i}`)?.hand.length ?? 0,
  );
  return {
    winner,
    actions,
    stalled: room.state.phase !== 'finished',
    invalid,
    pickupsBySeat,
    finalHandBySeat,
  };
}
