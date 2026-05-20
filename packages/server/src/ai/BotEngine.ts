import { GameState } from '@durak/shared';
import { Card, Rank, Suit } from '@durak/shared/src/state/Card';
import { DurakEngine } from '@durak/shared/src/engine/DurakEngine';

export type BotDifficulty = 'easy' | 'hard';

export interface BotMove {
  action: 'attack' | 'defend' | 'pickup' | 'swapHuzur';
  cards: Array<{ suit: string; rank: number; isJoker: boolean }>;
}

interface CardLite {
  suit: string;
  rank: number;
  isJoker: boolean;
}

// ---------- Valuation ----------

const TRUMP_BASE = 60;
const JOKER_BASE = 200;

function value(c: CardLite, trumpSuit: string): number {
  if (c.isJoker) return JOKER_BASE + (c.rank - 16) * 10; // BJ=200, RJ=220
  if (c.suit === trumpSuit) return TRUMP_BASE + (c.rank - 7) * 5; // trump 7=60, A=105
  return c.rank - 7; // 7=0 ... A=9
}

function cardKey(c: CardLite): string {
  return c.isJoker ? `J:${c.rank}` : `${c.suit}:${c.rank}`;
}

function toLite(c: CardLite): CardLite {
  return { suit: c.suit, rank: c.rank, isJoker: c.isJoker };
}

// ---------- Game-state helpers ----------

function nextActivePlayer(state: GameState, fromId: string): string | null {
  const ids = Array.from(state.seatOrder).filter((id): id is string => !!id);
  const idx = ids.indexOf(fromId);
  if (idx === -1) return null;
  for (let skip = 1; skip < ids.length; skip++) {
    const candidate = ids[(idx + skip) % ids.length];
    if (!candidate || state.winners.includes(candidate)) continue;
    return candidate;
  }
  return null;
}

function isTeammate(state: GameState, a: string, b: string): boolean {
  if (state.mode !== 'teams' && state.mode !== 'horse') return false;
  if (a === b) return false;
  const pa = state.players.get(a);
  const pb = state.players.get(b);
  if (!pa || !pb) return false;
  return pa.team === pb.team;
}

function activePlayerIds(state: GameState): string[] {
  return Array.from(state.seatOrder).filter(
    (id): id is string => !!id && !state.winners.includes(id),
  );
}

// ---------- Card counting ----------

interface UnseenInfo {
  trumpsRemaining: number;
  jokersRemaining: number;
  highTrumpsRemaining: number; // trump J+ or jokers
  unseenSize: number;
}

function buildUnseen(state: GameState, botId: string): UnseenInfo {
  const seen = new Set<string>();
  const mark = (c: CardLite | undefined) => {
    if (c) seen.add(cardKey(c));
  };
  state.discardPile.forEach(mark);
  state.table.forEach(mark);
  state.tableStacks.forEach(mark);
  state.activeAttackCards.forEach(mark);
  mark(state.huzurCard);
  state.players.get(botId)?.hand.forEach(mark);

  let trumps = 0;
  let jokers = 0;
  let highTrumps = 0;
  let unseenSize = 0;
  // 42-card deck: 10 ranks x 4 suits + 2 jokers
  const ranks = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
  for (const s of suits) {
    for (const r of ranks) {
      if (!seen.has(`${s}:${r}`)) {
        unseenSize++;
        if (s === state.huzurSuit) {
          trumps++;
          if (r >= Rank.Jack) highTrumps++;
        }
      }
    }
  }
  if (!seen.has(`J:${Rank.BlackJoker}`)) {
    unseenSize++;
    jokers++;
    highTrumps++;
  }
  if (!seen.has(`J:${Rank.RedJoker}`)) {
    unseenSize++;
    jokers++;
    highTrumps++;
  }
  return {
    trumpsRemaining: trumps,
    jokersRemaining: jokers,
    highTrumpsRemaining: highTrumps,
    unseenSize,
  };
}

// ---------- Defense search (cost-minimizing) ----------

function findCheapestDefense(
  hand: Card[],
  attackers: Card[],
  trumpSuit: string,
): { pairs: { atk: Card; def: Card }[]; cost: number } | null {
  // Sort attackers strongest-first so hard cases prune early.
  const sortedAtk = [...attackers].sort((a, b) => value(b, trumpSuit) - value(a, trumpSuit));
  const used = new Set<number>();
  const current: { atk: Card; def: Card }[] = [];
  let best: { atk: Card; def: Card }[] | null = null;
  let bestCost = Infinity;

  const bt = (idx: number, costSoFar: number): void => {
    if (costSoFar >= bestCost) return;
    if (idx === sortedAtk.length) {
      best = current.map((p) => ({ atk: p.atk, def: p.def }));
      bestCost = costSoFar;
      return;
    }
    const atk = sortedAtk[idx]!;
    const opts: { i: number; cost: number }[] = [];
    for (let i = 0; i < hand.length; i++) {
      if (used.has(i)) continue;
      const d = hand[i]!;
      if (DurakEngine.canDefend(d, atk, trumpSuit)) {
        opts.push({ i, cost: value(d, trumpSuit) });
      }
    }
    opts.sort((a, b) => a.cost - b.cost);
    for (const o of opts) {
      used.add(o.i);
      current.push({ atk, def: hand[o.i]! });
      bt(idx + 1, costSoFar + o.cost);
      current.pop();
      used.delete(o.i);
    }
  };
  bt(0, 0);
  return best ? { pairs: best, cost: bestCost } : null;
}

// ---------- Legal attack generation ----------

interface AttackOption {
  cards: Card[];
  isMass: boolean;
}

function generateAttackOptions(state: GameState, botId: string): AttackOption[] {
  const player = state.players.get(botId);
  if (!player) return [];
  const hand = Array.from(player.hand).filter((c): c is Card => !!c);
  const tableCards = Array.from(state.table).filter((c): c is Card => !!c);
  const activeAttacks = Array.from(state.activeAttackCards).filter((c): c is Card => !!c);
  const allPlayers = Array.from(state.players.values());
  const opts: AttackOption[] = [];
  const isFirst = tableCards.length === 0 && activeAttacks.length === 0;
  const allTable = [...tableCards, ...activeAttacks];

  // Single-card attacks
  for (const card of hand) {
    if (isFirst) {
      opts.push({ cards: [card], isMass: false });
    } else if (DurakEngine.isValidAttackAddition(card, allTable, activeAttacks)) {
      opts.push({ cards: [card], isMass: false });
    }
  }

  // Mass attacks — only on lead and only if conditions allow
  if (isFirst) {
    const rankGroups = new Map<number, Card[]>();
    for (const c of hand) {
      if (c.isJoker) continue;
      const g = rankGroups.get(c.rank) ?? [];
      g.push(c);
      rankGroups.set(c.rank, g);
    }
    const pairs: Card[][] = [];
    const singles: Card[] = [];
    rankGroups.forEach((group) => {
      if (group.length >= 2) pairs.push([group[0]!, group[1]!]);
      else singles.push(group[0]!);
    });
    // 3 / 5 / 7 -card masses
    for (const size of [3, 5, 7]) {
      if (hand.length < size) continue;
      const pairsNeeded = Math.floor(size / 2);
      if (pairs.length < pairsNeeded) continue;
      // Use lowest-rank pairs + lowest single
      const sortedPairs = [...pairs].sort((a, b) => a[0]!.rank - b[0]!.rank);
      const sortedSingles = [...singles].sort((a, b) => a.rank - b.rank);
      const massCards: Card[] = [];
      for (let i = 0; i < pairsNeeded; i++) massCards.push(...sortedPairs[i]!);
      if (sortedSingles[0]) massCards.push(sortedSingles[0]);
      else continue;
      if (massCards.length !== size) continue;
      if (
        DurakEngine.isValidMassAttack(
          massCards,
          allPlayers,
          state.deck.length,
          state.targetHandSize,
        )
      ) {
        opts.push({ cards: massCards, isMass: true });
      }
    }
  }
  return opts;
}

// ---------- Move scoring ----------

interface ScoredMove {
  move: BotMove;
  score: number;
}

function scoreAttack(
  state: GameState,
  botId: string,
  opt: AttackOption,
  ctx: { nextDefenderId: string | null; unseen: UnseenInfo },
): number {
  const trumpSuit = state.huzurSuit;
  const me = state.players.get(botId)!;
  const handSize = me.hand.length;
  const nextDefender = ctx.nextDefenderId;
  const teammate = nextDefender ? isTeammate(state, botId, nextDefender) : false;

  let score = 0;

  // Base: cost of giving up these cards
  let attackCost = 0;
  for (const c of opt.cards) attackCost += value(c, trumpSuit);
  score -= attackCost;

  // Pressure: harder-to-beat cards score better when attacking an opponent.
  const maxRank = Math.max(...opt.cards.map((c) => (c.isJoker ? c.rank + 10 : c.rank)));
  const hasTrumpOrJoker = opt.cards.some((c) => c.isJoker || c.suit === trumpSuit);

  if (teammate) {
    // Don't dump pressure on teammate. Prefer lowest-rank, non-trump, single-card.
    score -= maxRank * 4;
    if (hasTrumpOrJoker) score -= 80;
    if (opt.isMass) score -= 120; // mass attack on teammate is bad
  } else if (nextDefender) {
    // Opponent: reward pressure
    score += maxRank * 3;
    // Forcing pickup is great — proxy: if next defender hand is small & we attack with trumps
    const opp = state.players.get(nextDefender);
    if (opp && opp.hand.length <= 3 && hasTrumpOrJoker) score += 25;
    if (opt.isMass) {
      // Mass attack against an opponent is strong if we have a deep hand
      score += 30 + opt.cards.length * 5;
      if (handSize > opt.cards.length + 2) score += 20;
    }
  }

  // Trump conservation in early/mid game (deck still has cards)
  if (state.deck.length > 0 && hasTrumpOrJoker && !teammate) {
    // Slight penalty for burning trump while deck remains
    score -= 25;
  }

  // Endgame: small hands → dumping is good
  if (state.deck.length === 0 && handSize <= 4) {
    score += opt.cards.length * 6;
  }

  return score;
}

function scoreDefense(
  state: GameState,
  botId: string,
  defense: { pairs: { atk: Card; def: Card }[]; cost: number },
  ctx: { nextDefenderId: string | null; unseen: UnseenInfo },
): number {
  const trumpSuit = state.huzurSuit;
  const me = state.players.get(botId)!;
  const handSize = me.hand.length;
  const nextDefender = ctx.nextDefenderId;
  const teammate = nextDefender ? isTeammate(state, botId, nextDefender) : false;

  let score = -defense.cost;

  // Defense cards become next defender's attack. Strong cards = pressure.
  const maxDefRank = Math.max(
    ...defense.pairs.map((p) => (p.def.isJoker ? p.def.rank + 10 : p.def.rank)),
  );
  const usedTrumpOrJoker = defense.pairs.some((p) => p.def.isJoker || p.def.suit === trumpSuit);

  if (teammate) {
    // I'm passing my defense to my teammate. Strong cards hurt them. Penalize.
    score -= maxDefRank * 4;
    if (usedTrumpOrJoker) score -= 60;
  } else if (nextDefender) {
    // Opponent gets the pressure. Bonus.
    score += maxDefRank * 2;
    const opp = state.players.get(nextDefender);
    if (opp && opp.hand.length <= 3 && usedTrumpOrJoker) score += 30;
  }

  // Defending preserves hand health (we don't bloat). Small implicit bonus.
  score += 5;
  // Avoid bloating: defending vs picking up means handSize stays. Good when hand is already large.
  if (handSize >= state.targetHandSize + 2) score += 10;

  return score;
}

function scorePickup(state: GameState, botId: string): number {
  const trumpSuit = state.huzurSuit;
  const me = state.players.get(botId)!;
  const handSize = me.hand.length;
  const incoming = [
    ...Array.from(state.activeAttackCards).filter((c): c is Card => !!c),
    ...Array.from(state.table).filter((c): c is Card => !!c),
  ];
  let pickupValue = 0;
  for (const c of incoming) pickupValue += value(c, trumpSuit);

  let score = -incoming.length * 8; // hand bloat penalty
  // Bonus if pickup grants trumps/jokers (only when deck small or empty)
  if (state.deck.length <= 6) score += pickupValue * 0.4;
  else score += pickupValue * 0.15;
  // Heavy penalty if hand is already big
  if (handSize >= state.targetHandSize + 3) score -= 40;
  // In endgame (no deck), picking up is usually losing — penalty
  if (state.deck.length === 0) score -= 30;
  return score;
}

// ---------- Huzur swap ----------

// Returns true when the bot holds the swap-eligible card and the deck is non-empty.
// DurakEngine.swapHuzur enforces the picked-up restriction; we just gate on hand presence.
function canSwapHuzur(hand: Card[], state: GameState): boolean {
  if (state.deck.length === 0) return false;
  if (state.huzurCard.isJoker) {
    return hand.some((c) => c.suit === Suit.Spades && c.rank === Rank.Ace);
  }
  return hand.some((c) => c.suit === state.huzurSuit && c.rank === Rank.Seven);
}

// ---------- Move builder ----------

function moveFromAttack(opt: AttackOption): BotMove {
  return {
    action: 'attack',
    cards: opt.cards.map(toLite),
  };
}

function moveFromDefense(defense: { pairs: { atk: Card; def: Card }[] }): BotMove {
  return {
    action: 'defend',
    cards: defense.pairs.map((p) => toLite(p.def)),
  };
}

const PICKUP_MOVE: BotMove = { action: 'pickup', cards: [] };

// ---------- Main entry ----------

export class BotEngine {
  private pendingTurns = new Set<string>();

  async think(
    state: GameState,
    botId: string,
    difficulty: BotDifficulty = 'easy',
  ): Promise<BotMove | null> {
    const turnToken = `${botId}:${state.turnStartTime}`;
    if (this.pendingTurns.has(turnToken)) return null;
    this.pendingTurns.add(turnToken);

    try {
      const player = state.players.get(botId);
      if (!player) return null;
      const hand = Array.from(player.hand).filter((c): c is Card => !!c);

      // Always swap if eligible — free value, almost universally correct.
      if (canSwapHuzur(hand, state)) {
        return { action: 'swapHuzur', cards: [] };
      }

      const activeAttacks = Array.from(state.activeAttackCards).filter((c): c is Card => !!c);
      const nextDefenderId = nextActivePlayer(state, botId);
      const unseen = buildUnseen(state, botId);
      const ctx = { nextDefenderId, unseen };

      const candidates: ScoredMove[] = [];

      if (activeAttacks.length > 0) {
        // Defending
        const defense = findCheapestDefense(hand, activeAttacks, state.huzurSuit);
        if (defense) {
          candidates.push({
            move: moveFromDefense(defense),
            score: scoreDefense(state, botId, defense, ctx),
          });
        }
        candidates.push({ move: PICKUP_MOVE, score: scorePickup(state, botId) });
      } else {
        // Attacking
        const opts = generateAttackOptions(state, botId);
        for (const opt of opts) {
          candidates.push({
            move: moveFromAttack(opt),
            score: scoreAttack(state, botId, opt, ctx),
          });
        }
      }

      if (candidates.length === 0) return null;

      // Sort best-first
      candidates.sort((a, b) => b.score - a.score);

      if (difficulty === 'easy') {
        // Mistakes: 35% chance to pick a non-best, plus noise on top
        const noisy = candidates.map((c) => ({
          move: c.move,
          score: c.score + (Math.random() - 0.5) * 40,
        }));
        noisy.sort((a, b) => b.score - a.score);
        if (Math.random() < 0.35 && noisy.length > 1) {
          const pool = noisy.slice(0, Math.min(3, noisy.length));
          return pool[Math.floor(Math.random() * pool.length)]!.move;
        }
        return noisy[0]!.move;
      }

      // Hard: deterministic best with tiny tiebreak noise
      const tied = candidates.filter((c) => c.score === candidates[0]!.score);
      if (tied.length > 1) return tied[Math.floor(Math.random() * tied.length)]!.move;
      return candidates[0]!.move;
    } finally {
      this.pendingTurns.delete(turnToken);
    }
  }
}

export const botEngine = new BotEngine();
