import { GameState } from '@durak/shared';
import { Card } from '@durak/shared/src/state/Card';
import { DurakEngine } from '@durak/shared/src/engine/DurakEngine';

export interface BotMove {
  action: 'attack' | 'defend' | 'pickup';
  cards: Array<{ suit: string; rank: number; isJoker: boolean }>;
}

function fmt(c: { suit: string; rank: number; isJoker: boolean }): string {
  if (c.isJoker) return c.rank === 17 ? 'BlackJoker' : 'RedJoker';
  const rankNames: Record<number, string> = {
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: 'J',
    12: 'Q',
    13: 'K',
    14: '3',
    15: '2',
    16: 'A',
  };
  return `${rankNames[c.rank] ?? c.rank}${c.suit}`;
}

/** Backtracking search: selects exactly attackers.length cards from hand to cover all attackers. */
function findDefenseFromHand(
  hand: Card[],
  attackers: Card[],
  huzurSuit: string,
): { atk: Card; def: Card }[] | null {
  const usedHandIdx = new Set<number>();
  const assignments: { atk: Card; def: Card }[] = [];

  function backtrack(attackerIndex: number): boolean {
    if (attackerIndex === attackers.length) return true;
    const atk = attackers[attackerIndex]!;
    for (let i = 0; i < hand.length; i++) {
      if (usedHandIdx.has(i)) continue;
      const def = hand[i]!;
      if (DurakEngine.canDefend(def, atk, huzurSuit)) {
        usedHandIdx.add(i);
        assignments.push({ atk, def });
        if (backtrack(attackerIndex + 1)) return true;
        assignments.pop();
        usedHandIdx.delete(i);
      }
    }
    return false;
  }

  return backtrack(0) ? assignments : null;
}

export function buildLegalMoves(state: GameState, botId: string): BotMove[] {
  const player = state.players.get(botId);
  if (!player) return [];

  const hand = Array.from(player.hand).filter((c): c is Card => !!c);
  const activeAttacks = Array.from(state.activeAttackCards).filter((c): c is Card => !!c);
  const tableCards = Array.from(state.table).filter((c): c is Card => !!c);
  const allPlayers = Array.from(state.players.values());

  const moves: BotMove[] = [];

  if (activeAttacks.length > 0) {
    // Defending turn — find valid complete defense assignments from hand
    const assignment = findDefenseFromHand(hand, activeAttacks, state.huzurSuit);
    if (assignment) {
      moves.push({
        action: 'defend',
        cards: assignment.map((p) => ({
          suit: p.def.suit,
          rank: p.def.rank,
          isJoker: p.def.isJoker,
        })),
      });
    }
    // Always allowed to pick up
    moves.push({ action: 'pickup', cards: [] });
  } else {
    // Attacking turn — single card or mass attack
    for (const card of hand) {
      const isFirst = tableCards.length === 0 && activeAttacks.length === 0;
      if (isFirst) {
        moves.push({
          action: 'attack',
          cards: [{ suit: card.suit, rank: card.rank, isJoker: card.isJoker }],
        });
      } else {
        const allTable = [...tableCards, ...activeAttacks];
        if (DurakEngine.isValidAttackAddition(card, allTable, activeAttacks)) {
          moves.push({
            action: 'attack',
            cards: [{ suit: card.suit, rank: card.rank, isJoker: card.isJoker }],
          });
        }
      }
    }

    // Mass attacks (3/5/7 card)
    for (const size of [3, 5, 7]) {
      if (hand.length < size) continue;
      // Enumerate combos is expensive; try one mass: greedily pick pairs + a random
      const rankGroups = new Map<number, Card[]>();
      for (const c of hand) {
        if (!c.isJoker) {
          const group = rankGroups.get(c.rank) ?? [];
          group.push(c);
          rankGroups.set(c.rank, group);
        }
      }
      const pairs: Card[] = [];
      const singles: Card[] = [];
      for (const group of rankGroups.values()) {
        if (group.length >= 2) pairs.push(group[0]!, group[1]!);
        else singles.push(group[0]!);
      }
      const needed = Math.floor(size / 2); // pairs needed
      if (pairs.length / 2 >= needed) {
        const massCards = [...pairs.slice(0, needed * 2), ...(singles[0] ? [singles[0]] : [])];
        if (massCards.length === size) {
          const candidate = massCards.map((c) => ({
            suit: c.suit,
            rank: c.rank,
            isJoker: c.isJoker,
          }));
          if (
            DurakEngine.isValidMassAttack(
              massCards,
              allPlayers,
              state.deck.length,
              state.targetHandSize,
            )
          ) {
            moves.push({ action: 'attack', cards: candidate });
          }
        }
      }
    }
  }

  return moves;
}

export function serializeGameState(state: GameState, botId: string): string {
  const player = state.players.get(botId);
  if (!player) return '';

  const hand = Array.from(player.hand).filter((c): c is Card => !!c);
  const activeAttacks = Array.from(state.activeAttackCards).filter((c): c is Card => !!c);
  const tableStacks = Array.from(state.tableStacks).filter((c): c is Card => !!c);

  const handStr = hand.map(fmt).join(', ') || '(empty)';
  const attackStr = activeAttacks.map(fmt).join(', ') || 'none';
  const tableStr = tableStacks.length
    ? tableStacks
        .reduce<string[]>((acc, c, i) => {
          if (i % 2 === 0) acc.push(`[${fmt(c)}`);
          else acc[acc.length - 1] += `→${fmt(c)}]`;
          return acc;
        }, [])
        .join(' ')
    : 'empty';

  const opponentSummary = Array.from(state.seatOrder)
    .filter((id): id is string => !!id && id !== botId)
    .map((id) => {
      const p = state.players.get(id);
      return p ? `${p.username || id.slice(0, 6)}: ${p.hand.length} cards` : '';
    })
    .filter(Boolean)
    .join(', ');

  const isDefending = activeAttacks.length > 0;
  const role = isDefending ? 'DEFENDING' : 'ATTACKING';

  const moves = buildLegalMoves(state, botId);
  const moveList = moves
    .map((m, i) => {
      if (m.action === 'pickup') return `${i + 1}. Pick up all cards`;
      const cardStr = m.cards.map(fmt).join(', ');
      return `${i + 1}. ${m.action === 'attack' ? 'Attack' : 'Defend'} with ${cardStr}`;
    })
    .join('\n');

  return `YOUR ROLE: ${role}
YOUR HAND: ${handStr}
TRUMP SUIT: ${state.huzurSuit} (trump card: ${fmt(state.huzurCard)})
ACTIVE ATTACK (you must beat these): ${attackStr}
TABLE (resolved pairs this round): ${tableStr}
DECK SIZE: ${state.deck.length}
OPPONENTS: ${opponentSummary}

LEGAL MOVES:
${moveList}

Respond with ONLY a JSON object: {"choice": <number>} where <number> is the move number above.`;
}

export const SYSTEM_PROMPT = `You are playing a custom card game called Durak (Hot Potato variant) with a 42-card deck.

CARD HIERARCHY (low to high): 7, 8, 9, 10, J, Q, K, 3, 2, A, BlackJoker, RedJoker.
TRUMP (Huzur): Trump cards beat any non-trump card of the same suit comparison.
JOKERS: Beat everything (RedJoker > BlackJoker).

GOAL: Empty your hand when the deck runs out. The last player holding cards loses.

RULES:
- Attacking: Play 1 card, or a mass attack (3/5/7 cards with enough pairs).
- Defending: Beat each attacking card 1-to-1. Same suit + higher rank, OR trump beats non-trump, OR joker beats all.
- Pick up: Take all table cards into your hand if you can't defend.
- Hot Potato: After defending, your defense cards become the next player's attack.

STRATEGY TIPS:
- Conserve trump cards — use them only when necessary.
- Attack with ranks already on the table to limit opponent's defense options.
- If your hand is large, prefer picking up over wasting strong cards.
- Lead with low-value non-trump when attacking.

You MUST respond with ONLY: {"choice": <number>}`;
