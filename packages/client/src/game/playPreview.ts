import { Card, DurakEngine } from '@durak/shared';
import { cardLabel, type TableCard } from './tableSnapshot';

export interface PlayPreview {
  readonly kind: 'attack' | 'defense';
  readonly legal: boolean;
  /** Why the selection cannot be sent yet, shown beside the action. */
  readonly reason?: string;
  /** Defense only: which selected card beats which attacking card. */
  readonly pairs?: readonly { attack: TableCard; defense: TableCard }[];
}

export interface PreviewContext {
  readonly attacks: readonly TableCard[];
  /** Resolved attack cards already on the table (ranks that may be added). */
  readonly table: readonly TableCard[];
  readonly huzurSuit: string;
  /** Public hand counts of every player, including the viewer. */
  readonly handCounts: readonly number[];
  readonly deckCount: number;
  readonly targetHandSize: number;
}

const toCard = (c: TableCard) => new Card(c.suit, c.rank, c.isJoker);

/**
 * Previews a selection with the same shared rules the server applies when it
 * is confirmed. The server remains authoritative; this only explains in advance.
 */
export function previewPlay(
  selected: readonly TableCard[],
  context: PreviewContext,
): PlayPreview | null {
  if (selected.length === 0) return null;
  if (context.attacks.length > 0) return previewDefense(selected, context);

  const cards = selected.map(toCard);
  if (cards.length === 1) {
    const legal =
      context.table.length === 0 ||
      DurakEngine.isValidAttackAddition(cards[0]!, context.table.map(toCard), []);
    return legal
      ? { kind: 'attack', legal }
      : { kind: 'attack', legal, reason: 'Add a rank that is already on the table.' };
  }
  const legal = DurakEngine.isValidMassAttackForHandCounts(
    cards,
    [...context.handCounts],
    context.deckCount,
    context.targetHandSize,
  );
  if (legal) return { kind: 'attack', legal };
  return { kind: 'attack', legal, reason: massReason(cards, context) };
}

function previewDefense(selected: readonly TableCard[], context: PreviewContext): PlayPreview {
  const missing = context.attacks.length - selected.length;
  if (missing !== 0)
    return {
      kind: 'defense',
      legal: false,
      reason:
        missing > 0
          ? `Select ${missing} more ${missing === 1 ? 'card' : 'cards'}: one for each attacking card.`
          : `Select only ${context.attacks.length}: one card for each attacking card.`,
    };
  const byCard = new Map<Card, TableCard>();
  const defenders = selected.map((c) => {
    const card = toCard(c);
    byCard.set(card, c);
    return card;
  });
  const attackers = context.attacks.map((c) => {
    const card = toCard(c);
    byCard.set(card, c);
    return card;
  });
  const assignment = DurakEngine.findDefenseAssignment(defenders, attackers, context.huzurSuit);
  if (!assignment)
    return {
      kind: 'defense',
      legal: false,
      reason: 'Each card must beat one attacking card: the same suit and higher, or a trump.',
    };
  return {
    kind: 'defense',
    legal: true,
    pairs: assignment.map(({ atk, def }) => ({
      attack: byCard.get(atk)!,
      defense: byCard.get(def)!,
    })),
  };
}

/** Explains which mass-attack condition failed. Legality itself comes from the engine. */
function massReason(cards: Card[], context: PreviewContext): string {
  const n = cards.length;
  if (n !== 3 && n !== 5 && n !== 7) return 'Play one card, or a mass attack of 3, 5 or 7 cards.';
  if (context.handCounts.some((count) => count < n))
    return `Every player needs at least ${n} cards for a ${n}-card mass attack.`;
  if (n === 7 && context.targetHandSize !== 7) return 'A 7-card mass attack needs a 7-card game.';
  if (n > 3 && context.deckCount > 0 && (n === 7 || context.targetHandSize !== 7))
    return `A ${n}-card mass attack is allowed once the deck is empty.`;
  const pairs = (n - 1) / 2;
  return `A ${n}-card mass attack needs at least ${pairs} ${pairs === 1 ? 'pair' : 'pairs'}.`;
}

export function describePairs(preview: PlayPreview): string {
  return (preview.pairs ?? [])
    .map(({ attack, defense }) => `${cardLabel(defense)} beats ${cardLabel(attack)}`)
    .join(' · ');
}
