import * as ort from 'onnxruntime-node';
import * as path from 'path';
import { GameState } from '@durak/shared';
import { Card, Suit, Rank } from '@durak/shared/src/state/Card';
import { BotMove } from './BotEngine';

// -----------------------------------------------------------------------
// Card encoding — mirrors packages/trainer/durak_env.py
// -----------------------------------------------------------------------

const SUITS_ORDER = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
const RANKS_ORDER = [
  Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack,
  Rank.Queen, Rank.King, Rank.Three, Rank.Two, Rank.Ace,
];

const ACTION_PASS = 42;
const ACTION_SWAP = 43;
const OBS_DIM    = 176;
const ACTION_DIM = 44;

interface CardLite {
  suit: string;
  rank: number;
  isJoker: boolean;
}

function cardToIdx(c: CardLite): number {
  if (c.isJoker) {
    return c.rank === Rank.BlackJoker ? 40 : 41;
  }
  const sIdx = SUITS_ORDER.indexOf(c.suit as Suit);
  const rIdx = RANKS_ORDER.indexOf(c.rank);
  if (sIdx === -1 || rIdx === -1) throw new Error(`Unknown card ${JSON.stringify(c)}`);
  return sIdx * 10 + rIdx;
}

function idxToCard(i: number): CardLite {
  if (i === 40) return { suit: Suit.None, rank: Rank.BlackJoker, isJoker: true };
  if (i === 41) return { suit: Suit.None, rank: Rank.RedJoker,   isJoker: true };
  const sIdx = Math.floor(i / 10);
  const rIdx = i % 10;
  return { suit: SUITS_ORDER[sIdx]!, rank: RANKS_ORDER[rIdx]!, isJoker: false };
}

function trumpSuitIdx(huzurSuit: string): number {
  const idx = SUITS_ORDER.indexOf(huzurSuit as Suit);
  return idx === -1 ? 0 : idx;
}

// -----------------------------------------------------------------------
// Observation builder
// -----------------------------------------------------------------------

function buildObs(
  state: GameState,
  botId: string,
  staged: number[],
  assignedDefenses: number[],
): Float32Array {
  const obs = new Float32Array(OBS_DIM);

  const player = state.players.get(botId);
  if (!player) return obs;

  // [0:42] my hand
  for (const c of player.hand) {
    const idx = cardToIdx(c as CardLite);
    obs[idx] = 1;
  }
  // subtract already-assigned defenses so we don't pick the same card twice
  for (const idx of assignedDefenses) obs[idx] = 0;

  // [42:84] active attacks
  for (const c of state.activeAttackCards) {
    if (c) obs[42 + cardToIdx(c as CardLite)] = 1;
  }

  // [84:126] table (resolved pairs)
  for (const c of state.table) {
    if (c) obs[84 + cardToIdx(c as CardLite)] = 1;
  }
  for (const c of state.tableStacks) {
    if (c) obs[84 + cardToIdx(c as CardLite)] = 1;
  }

  // [126:168] staged attack buffer
  for (const idx of staged) {
    obs[126 + idx] = 1;
  }

  // [168:172] trump suit one-hot
  obs[168 + trumpSuitIdx(state.huzurSuit)] = 1;

  // [172] is_attacker (no active attacks means we are the attacker)
  const isAttacker = state.activeAttackCards.length === 0;
  obs[172] = isAttacker ? 1 : 0;

  // [173] deck_size / 42
  obs[173] = state.deck.length / 42;

  // [174] opp_hand_size / 42
  let oppHandSize = 0;
  state.players.forEach((p, id) => {
    if (id !== botId) oppHandSize = p.hand.length;
  });
  obs[174] = oppHandSize / 42;

  // [175] staging_progress
  obs[175] = staged.length / 7;

  return obs;
}

// -----------------------------------------------------------------------
// Legal action masks (TypeScript replication of env logic)
// -----------------------------------------------------------------------

function buildAttackMask(state: GameState, botId: string, staged: number[]): boolean[] {
  const mask = new Array<boolean>(ACTION_DIM).fill(false);
  const player = state.players.get(botId);
  if (!player) return mask;

  const hand = Array.from(player.hand).filter(Boolean).map((c) => cardToIdx(c as CardLite));
  const tableCards = [
    ...Array.from(state.table).filter(Boolean).map((c) => cardToIdx(c as CardLite)),
    ...Array.from(state.activeAttackCards).filter(Boolean).map((c) => cardToIdx(c as CardLite)),
  ];

  if (staged.length === 0) {
    // Opening — any hand card is legal
    for (const idx of hand) mask[idx] = true;
  } else {
    // Staging — must match a rank already on table or in staged
    const playedRanks = new Set<number>();
    for (const idx of [...staged, ...tableCards]) {
      const c = idxToCard(idx);
      if (!c.isJoker) playedRanks.add(c.rank);
    }
    for (const idx of hand) {
      const c = idxToCard(idx);
      if (c.isJoker || playedRanks.has(c.rank)) mask[idx] = true;
    }
    mask[ACTION_PASS] = true; // commit staged
  }

  return mask;
}

function buildDefenseMask(
  state: GameState,
  botId: string,
  assignedDefenses: number[],
): boolean[] {
  const mask = new Array<boolean>(ACTION_DIM).fill(false);
  const player = state.players.get(botId);
  if (!player) { mask[ACTION_PASS] = true; return mask; }

  const hand = Array.from(player.hand).filter(Boolean).map((c) => cardToIdx(c as CardLite));
  const available = hand.filter((idx) => !assignedDefenses.includes(idx));

  const activeAttacks = Array.from(state.activeAttackCards)
    .filter(Boolean)
    .map((c) => cardToIdx(c as CardLite));

  const { huzurSuit } = state;

  for (const defIdx of available) {
    for (const atkIdx of activeAttacks) {
      if (canDefend(defIdx, atkIdx, huzurSuit)) {
        mask[defIdx] = true;
        break;
      }
    }
  }
  mask[ACTION_PASS] = true;
  return mask;
}

function canDefend(defIdx: number, atkIdx: number, trumpSuit: string): boolean {
  const def = idxToCard(defIdx);
  const atk = idxToCard(atkIdx);
  if (def.isJoker) return atk.isJoker ? def.rank > atk.rank : true;
  if (atk.isJoker) return false;
  if (def.suit === atk.suit) return def.rank > atk.rank;
  if (def.suit === trumpSuit && atk.suit !== trumpSuit) return true;
  return false;
}

// -----------------------------------------------------------------------
// ONNX inference
// -----------------------------------------------------------------------

const MODEL_PATH = path.resolve(__dirname, '../../ml/durak_bot.onnx');

let _session: ort.InferenceSession | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (!_session) {
    _session = await ort.InferenceSession.create(MODEL_PATH);
  }
  return _session;
}

async function runOnnx(obs: Float32Array, mask: boolean[]): Promise<number> {
  const session = await getSession();
  const obsTensor  = new ort.Tensor('float32', obs,   [1, OBS_DIM]);
  const maskTensor = new ort.Tensor('bool',    mask,  [1, ACTION_DIM]);

  const results = await session.run({ obs: obsTensor, mask: maskTensor });
  const logits  = results['logits']!.data as Float32Array;

  // Argmax over legal actions
  let bestAction = -1;
  let bestLogit  = -Infinity;
  for (let i = 0; i < ACTION_DIM; i++) {
    if (mask[i] && logits[i]! > bestLogit) {
      bestLogit  = logits[i]!;
      bestAction = i;
    }
  }
  return bestAction;
}

// -----------------------------------------------------------------------
// Main bot class
// -----------------------------------------------------------------------

export class OnnxBotEngine {
  async think(state: GameState, botId: string): Promise<BotMove | null> {
    try {
      const player = state.players.get(botId);
      if (!player) return null;

      const activeAttacks = Array.from(state.activeAttackCards).filter(Boolean) as Card[];

      if (activeAttacks.length === 0) {
        return await this._decideAttack(state, botId);
      } else {
        return await this._decideDefense(state, botId, activeAttacks);
      }
    } catch {
      return null;
    }
  }

  private async _decideAttack(state: GameState, botId: string): Promise<BotMove> {
    const staged: number[] = [];

    // Up to 7 steps to build a staged attack, then commit
    for (let step = 0; step < 8; step++) {
      const obs  = buildObs(state, botId, staged, []);
      const mask = buildAttackMask(state, botId, staged);
      const action = await runOnnx(obs, mask);

      if (action === ACTION_PASS || action === -1) break;
      if (action === ACTION_SWAP) {
        return { action: 'swapHuzur', cards: [] };
      }
      staged.push(action);

      // After first card, if model keeps choosing ACTION_PASS-equivalent,
      // break so we at least send the staged card(s).
      if (staged.length >= 7) break;
    }

    if (staged.length === 0) return { action: 'pickup', cards: [] };

    return {
      action: 'attack',
      cards: staged.map((idx) => {
        const c = idxToCard(idx);
        return { suit: c.suit, rank: c.rank, isJoker: c.isJoker };
      }),
    };
  }

  private async _decideDefense(
    state: GameState,
    botId: string,
    activeAttacks: Card[],
  ): Promise<BotMove> {
    const assignedDefenseIdxs: number[] = [];

    for (let i = 0; i < activeAttacks.length; i++) {
      const obs  = buildObs(state, botId, [], assignedDefenseIdxs);
      const mask = buildDefenseMask(state, botId, assignedDefenseIdxs);
      const action = await runOnnx(obs, mask);

      if (action === ACTION_PASS || action === -1) {
        return { action: 'pickup', cards: [] };
      }
      assignedDefenseIdxs.push(action);
    }

    return {
      action: 'defend',
      cards: assignedDefenseIdxs.map((idx) => {
        const c = idxToCard(idx);
        return { suit: c.suit, rank: c.rank, isJoker: c.isJoker };
      }),
    };
  }
}

export const onnxBotEngine = new OnnxBotEngine();
