/**
 * ONNX-backed bot using the snapshot-pool trained model.
 *
 * Observation layout (OBS_DIM = 176) — must stay in sync with durak_env.py:
 *   [0:42]    my hand one-hot
 *   [42:84]   active (undefended) attack cards one-hot
 *   [84:126]  table/defended pairs one-hot (both atk + def cards)
 *   [126:168] staged attack buffer one-hot (accumulated during staging loop)
 *   [168:172] trump suit 4-bit one-hot (Spades,Hearts,Diamonds,Clubs)
 *   [172]     is_attacker (1/0)
 *   [173]     deck_size / 42
 *   [174]     opp_hand_size / 42
 *   [175]     staging_progress (staged_len / 7)
 *
 * Action space (ACTION_DIM = 44):
 *   0–41  card index (suit*10 + rank_idx, jokers at 40/41)
 *   42    ACTION_PASS  (attacker commits / defender picks up)
 *   43    ACTION_SWAP  (huzur swap)
 */

import { GameState } from '@durak/shared';
import { Card, Suit, Rank } from '@durak/shared/src/state/Card';
import { BotMove } from './BotEngine';

// Lazy-load so missing native binding doesn't crash the server.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ort: any = null;
try {
  ort = require('onnxruntime-node');
} catch {
  // Native binding unavailable (e.g. musl/Alpine). OnnxBot.isLoaded will stay false.
}

// ── Card index constants ─────────────────────────────────────────────────────

const SUITS: string[] = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
const RANKS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]; // 14=Three, 15=Two, 16=Ace

function cardIndex(suit: string, rank: number, isJoker: boolean): number {
  if (isJoker) return rank === Rank.BlackJoker ? 40 : 41;
  const si = SUITS.indexOf(suit);
  const ri = RANKS.indexOf(rank);
  if (si === -1 || ri === -1) return -1;
  return si * 10 + ri;
}

function idxToCard(idx: number): { suit: string; rank: number; isJoker: boolean } | null {
  if (idx === 40) return { suit: 'None', rank: Rank.BlackJoker, isJoker: true };
  if (idx === 41) return { suit: 'None', rank: Rank.RedJoker, isJoker: true };
  if (idx < 0 || idx > 39) return null;
  return { suit: SUITS[Math.floor(idx / 10)]!, rank: RANKS[idx % 10]!, isJoker: false };
}

// ── Rank helpers ─────────────────────────────────────────────────────────────

const RANK_STRENGTH: Record<number, number> = {};
RANKS.forEach((r, i) => {
  RANK_STRENGTH[r] = i;
});

function canDefend(defCard: Card, atkCard: Card, trumpSuit: string): boolean {
  if (defCard.isJoker) return true;
  if (atkCard.isJoker) return false;
  if (defCard.suit === atkCard.suit)
    return (RANK_STRENGTH[defCard.rank] ?? 0) > (RANK_STRENGTH[atkCard.rank] ?? 0);
  return defCard.suit === trumpSuit && atkCard.suit !== trumpSuit;
}

const OBS_DIM = 176;
const ACTION_DIM = 44;
const ACTION_PASS = 42;
const ACTION_SWAP = 43;

// ── Observation builder ───────────────────────────────────────────────────────

function buildObs(
  state: GameState,
  botId: string,
  staged: number[], // card indices of staged attack (accumulated across loop iters)
): Float32Array {
  const obs = new Float32Array(OBS_DIM);
  const player = state.players.get(botId);
  if (!player) return obs;

  // [0:42] my hand
  for (const c of player.hand) {
    if (!c) continue;
    const i = cardIndex(c.suit, c.rank, c.isJoker);
    if (i >= 0) obs[i] = 1;
  }

  // [42:84] active attacks
  for (const c of state.activeAttackCards) {
    if (!c) continue;
    const i = cardIndex(c.suit, c.rank, c.isJoker);
    if (i >= 0) obs[42 + i] = 1;
  }

  // [84:126] table / defended pairs (tableStacks contains both atk+def cards)
  for (const c of state.tableStacks) {
    if (!c) continue;
    const i = cardIndex(c.suit, c.rank, c.isJoker);
    if (i >= 0) obs[84 + i] = 1;
  }

  // [126:168] staged attack buffer
  for (const idx of staged) {
    if (idx >= 0 && idx < 42) obs[126 + idx] = 1;
  }

  // [168:172] trump suit one-hot
  const trumpIdx = SUITS.indexOf(state.huzurSuit);
  if (trumpIdx >= 0) obs[168 + trumpIdx] = 1;

  // [172] is_attacker
  const isDefending = state.activeAttackCards.length > 0;
  obs[172] = isDefending ? 0 : 1;

  // [173] deck size
  obs[173] = (state.deck?.length ?? 0) / 42;

  // [174] opponent hand size (first other active player)
  const seatOrder = Array.from(state.seatOrder).filter((s): s is string => !!s);
  const opp = seatOrder.find((id) => id !== botId && !state.winners.includes(id));
  obs[174] = opp ? (state.players.get(opp)?.hand.length ?? 0) / 42 : 0;

  // [175] staging progress
  obs[175] = staged.length / 7;

  return obs;
}

// ── Legal mask builders ───────────────────────────────────────────────────────

function buildAttackMask(state: GameState, botId: string, staged: number[]): Uint8Array {
  const mask = new Uint8Array(ACTION_DIM);
  const player = state.players.get(botId);
  if (!player) return mask;

  const hand = Array.from(player.hand).filter((c): c is Card => !!c);

  // Collect ranks already on table or in staged
  const allowedRanks = new Set<number>();
  for (const c of state.activeAttackCards) if (c) allowedRanks.add(c.rank);
  for (const c of state.tableStacks) if (c) allowedRanks.add(c.rank);
  const stagedCards = staged.map(idxToCard).filter(Boolean);
  for (const c of stagedCards) if (c) allowedRanks.add(c.rank);

  const isFirstCard =
    staged.length === 0 && state.activeAttackCards.length === 0 && state.tableStacks.length === 0;

  for (const c of hand) {
    if (isFirstCard || c.isJoker || allowedRanks.has(c.rank)) {
      const idx = cardIndex(c.suit, c.rank, c.isJoker);
      if (idx >= 0) mask[idx] = 1;
    }
  }

  // PASS to commit (only if something staged)
  if (staged.length > 0) mask[ACTION_PASS] = 1;

  // Swap huzur
  const canSwap =
    staged.length === 0 &&
    (state.deck?.length ?? 0) > 0 &&
    hand.some((c) => c.suit === state.huzurSuit && c.rank === Rank.Seven);
  if (canSwap) mask[ACTION_SWAP] = 1;

  return mask;
}

function buildDefenseMask(
  state: GameState,
  botId: string,
  assigned: Set<number>, // card indices already assigned to earlier attacks
): Uint8Array {
  const mask = new Uint8Array(ACTION_DIM);
  const player = state.players.get(botId);
  if (!player) return mask;

  const hand = Array.from(player.hand)
    .filter((c): c is Card => !!c)
    .filter((c) => !assigned.has(cardIndex(c.suit, c.rank, c.isJoker)));

  for (const c of hand) {
    if (state.activeAttackCards.some((atk) => atk && canDefend(c, atk, state.huzurSuit))) {
      const idx = cardIndex(c.suit, c.rank, c.isJoker);
      if (idx >= 0) mask[idx] = 1;
    }
  }
  mask[ACTION_PASS] = 1; // always can pick up
  return mask;
}

// ── ONNX inference ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runInference(session: any, obs: Float32Array, mask: Uint8Array): Promise<number> {
  const boolMask = new Uint8Array(mask); // onnxruntime-node uses uint8 for bool tensors
  const obsTensor = new ort.Tensor('float32', obs, [1, OBS_DIM]);
  const maskTensor = new ort.Tensor('bool', boolMask, [1, ACTION_DIM]);
  const out = await session.run({ obs: obsTensor, mask: maskTensor });

  // Model outputs 'logits' (new model) — fall back to 'log_probs' for old model
  const logits = (out['logits'] ?? out['log_probs'])?.data as Float32Array | undefined;
  if (!logits) return ACTION_PASS;

  let best = -1;
  let bestVal = -Infinity;
  for (let i = 0; i < ACTION_DIM; i++) {
    if (mask[i] && logits[i] > bestVal) {
      bestVal = logits[i];
      best = i;
    }
  }
  return best === -1 ? ACTION_PASS : best;
}

// ── OnnxBot ───────────────────────────────────────────────────────────────────

export class OnnxBot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;
  private modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  async load(): Promise<void> {
    if (!ort) throw new Error('onnxruntime-node native binding unavailable');
    this.session = await ort.InferenceSession.create(this.modelPath, {
      executionProviders: ['cpu'],
    });
  }

  get isLoaded(): boolean {
    return this.session !== null;
  }

  async think(state: GameState, botId: string): Promise<BotMove | null> {
    if (!this.session) return null;
    const player = state.players.get(botId);
    if (!player) return null;

    const isDefending = state.activeAttackCards.length > 0;

    if (isDefending) {
      return this._thinkDefense(state, botId);
    } else {
      return this._thinkAttack(state, botId);
    }
  }

  private async _thinkAttack(state: GameState, botId: string): Promise<BotMove | null> {
    const staged: number[] = []; // card indices accumulated during staging
    const player = state.players.get(botId);
    if (!player) return null;

    // Build a local set of hand indices (updated as we stage cards)
    const handSet = new Set<number>(
      Array.from(player.hand)
        .filter((c): c is Card => !!c)
        .map((c) => cardIndex(c.suit, c.rank, c.isJoker))
        .filter((i) => i >= 0),
    );

    for (let iter = 0; iter < 8; iter++) {
      const obs = buildObs(state, botId, staged);
      const mask = buildAttackMask(state, botId, staged);

      // Override hand bits to reflect already-staged cards
      for (const idx of staged) {
        obs[idx] = 0; // remove from hand portion
        if (idx >= 0) mask[idx] = 0; // can't replay same card
      }

      // If no legal cards and nothing staged, fall back
      const anyCard = Array.from(mask).slice(0, 42).some(Boolean);
      if (!anyCard && staged.length === 0) return null;

      const action = await runInference(this.session, obs, mask);

      if (action === ACTION_PASS || action === ACTION_SWAP) {
        if (action === ACTION_SWAP) {
          return { action: 'swapHuzur', cards: [] };
        }
        break; // commit whatever is staged
      }

      if (action < 42 && mask[action]) {
        staged.push(action);
        handSet.delete(action);
      } else {
        break;
      }

      if (staged.length >= 7) break;
    }

    if (staged.length === 0) return null;

    // Map staged indices back to actual cards in hand
    const cards = staged
      .map((idx) => {
        const spec = idxToCard(idx);
        if (!spec) return null;
        const card = Array.from(player.hand).find(
          (c) => c && c.suit === spec.suit && c.rank === spec.rank && c.isJoker === spec.isJoker,
        );
        return card ? { suit: card.suit, rank: card.rank, isJoker: card.isJoker } : null;
      })
      .filter((c): c is { suit: string; rank: number; isJoker: boolean } => c !== null);

    if (cards.length === 0) return null;
    return { action: 'attack', cards };
  }

  private async _thinkDefense(state: GameState, botId: string): Promise<BotMove | null> {
    const player = state.players.get(botId);
    if (!player) return null;

    const assigned = new Set<number>(); // indices of hand cards already assigned
    const defCards: Array<{ suit: string; rank: number; isJoker: boolean }> = [];

    for (const atk of state.activeAttackCards) {
      if (!atk) continue;

      const obs = buildObs(state, botId, []);
      const mask = buildDefenseMask(state, botId, assigned);

      // Mark already-assigned cards as illegal
      for (const idx of assigned) {
        if (idx >= 0 && idx < ACTION_DIM) mask[idx] = 0;
      }

      const action = await runInference(this.session, obs, mask);

      if (action === ACTION_PASS) {
        return { action: 'pickup', cards: [] };
      }

      if (action < 42 && mask[action]) {
        const spec = idxToCard(action);
        if (!spec) return { action: 'pickup', cards: [] };
        const card = Array.from(player.hand).find(
          (c) => c && c.suit === spec.suit && c.rank === spec.rank && c.isJoker === spec.isJoker,
        );
        if (!card) return { action: 'pickup', cards: [] };
        // Verify this card actually beats the target
        if (!canDefend(card, atk, state.huzurSuit)) {
          return { action: 'pickup', cards: [] };
        }
        defCards.push({ suit: card.suit, rank: card.rank, isJoker: card.isJoker });
        assigned.add(action);
      } else {
        return { action: 'pickup', cards: [] };
      }
    }

    if (defCards.length === 0) return { action: 'pickup', cards: [] };
    return { action: 'defend', cards: defCards };
  }
}
