export interface ResponseCard {
  suit: string;
  rank: number;
  isJoker: boolean;
}

export interface AttackResponseStats {
  attempts: number;
  pickups: number;
  defensePower: number;
  defenseCards: Record<string, number>;
}

export type OpponentResponseProfile = Map<string, AttackResponseStats>;
export type OpponentResponseMemory = Map<string, OpponentResponseProfile>;

function cardPower(card: ResponseCard, trumpSuit: string): number {
  if (card.isJoker) return 200 + (card.rank - 16) * 10;
  if (card.suit === trumpSuit) return 60 + (card.rank - 7) * 5;
  return card.rank - 7;
}

function attackCategories(attacks: ResponseCard[], trumpSuit: string, pileSize: number): string[] {
  const strength = Math.max(
    ...attacks.map((card) => card.rank + (card.isJoker ? 10 : card.suit === trumpSuit ? 5 : 0)),
  );
  const hasTrump = attacks.some((card) => card.isJoker || card.suit === trumpSuit);
  return [
    attacks.length > 1 ? 'shape:multiple' : 'shape:single',
    strength >= 15 ? 'pressure:high' : 'pressure:low',
    hasTrump ? 'trump:yes' : 'trump:no',
    pileSize >= 6 ? 'pile:large' : pileSize >= 3 ? 'pile:medium' : 'pile:small',
  ];
}

/** Store only public attack/response information after a defender has acted. */
export function observeOpponentResponse(
  memory: OpponentResponseMemory,
  defenderId: string,
  attacks: ResponseCard[],
  trumpSuit: string,
  defendingCards: ResponseCard[] | null,
  pileSize = attacks.length,
): void {
  if (attacks.length === 0) return;
  let profile = memory.get(defenderId);
  if (!profile) {
    profile = new Map();
    memory.set(defenderId, profile);
  }

  const categories = ['all', ...attackCategories(attacks, trumpSuit, pileSize)];
  const defensePower = (defendingCards ?? []).reduce(
    (sum, card) => sum + cardPower(card, trumpSuit),
    0,
  );
  for (const category of categories) {
    const stats = profile.get(category) ?? {
      attempts: 0,
      pickups: 0,
      defensePower: 0,
      defenseCards: {},
    };
    stats.attempts++;
    if (!defendingCards) stats.pickups++;
    else {
      stats.defensePower += defensePower;
      for (const card of defendingCards) {
        const key = card.isJoker ? `J:${card.rank}` : `${card.suit}:${card.rank}`;
        stats.defenseCards[key] = (stats.defenseCards[key] ?? 0) + 1;
      }
    }
    profile.set(category, stats);
  }
}

/**
 * Estimate attack value against this defender from past public responses.
 * Pickup habits and the cost of cards spent defending both count as pressure.
 */
export function opponentResponseAttackBonus(
  profile: OpponentResponseProfile | undefined,
  attacks: ResponseCard[],
  trumpSuit: string,
  pileSize = attacks.length,
): number {
  const overall = profile?.get('all');
  if (!profile || !overall || overall.attempts === 0) return 0;

  const priorPickupRate = (overall.pickups + 1) / (overall.attempts + 2);
  const priorDefensePower = overall.attempts > 0 ? overall.defensePower / overall.attempts : 0;
  const overallUtility =
    priorPickupRate * 55 + (1 - priorPickupRate) * Math.min(40, priorDefensePower * 0.3);

  let adjustment = 0;
  const categories = attackCategories(attacks, trumpSuit, pileSize);
  for (const category of categories) {
    const stats = profile.get(category);
    if (!stats || stats.attempts === 0) continue;
    const pickupRate = (stats.pickups + priorPickupRate * 4) / (stats.attempts + 4);
    const defensePower = (stats.defensePower + priorDefensePower * 4) / (stats.attempts + 4);
    const categoryUtility = pickupRate * 55 + (1 - pickupRate) * Math.min(40, defensePower * 0.3);
    const confidence = stats.attempts / (stats.attempts + 4);
    adjustment += (categoryUtility - overallUtility) * confidence;
  }
  return adjustment / categories.length;
}
