/** Tunable, public-information heuristic weights for Durak bots. */
export interface BotPolicy {
  id: string;
  trumpCost: number;
  jokerCost: number;
  attackCostScale: number;
  attackPressure: number;
  /** Optional pressure weight while cards remain in the deck. */
  earlyAttackPressure?: number;
  massBonus: number;
  endgameDump: number;
  defensePressure: number;
  pickupValue: number;
  /** Reward attacks that the next player is unlikely to defend, based on unseen cards. */
  forcePickupWeight?: number;
  /** Extra urgency when a duel opponent can finish after a successful defense. */
  blockFinishWeight?: number;
  /** Reduce the attack cost of trumps and jokers once the deck is empty. */
  endgamePowerDiscount?: number;
  /** Reward a legal attack that empties our hand after the deck is exhausted. */
  finishWinBonus?: number;
  exploreMass: boolean;
  exploreDefense: boolean;
}

export const BASELINE_POLICY: BotPolicy = {
  id: 'baseline',
  trumpCost: 1,
  jokerCost: 1,
  attackCostScale: 1,
  attackPressure: 1,
  massBonus: 1,
  endgameDump: 1,
  defensePressure: 1,
  pickupValue: 1,
  forcePickupWeight: 0,
  endgamePowerDiscount: 1,
  exploreMass: false,
  exploreDefense: false,
};
