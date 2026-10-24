import { BotPolicy } from './BotPolicy';

// Promoted by the one-on-one bot lab after holdout evaluation.
export const DUEL_CHAMPION_POLICY: BotPolicy = {
  id: 'duel-champion',
  trumpCost: 1.45,
  jokerCost: 1.4,
  attackCostScale: 0.7,
  attackPressure: -0.19999999999999998,
  massBonus: 2.2,
  endgameDump: 3,
  defensePressure: 1,
  pickupValue: 1,
  forcePickupWeight: 20,
  blockFinishWeight: 400,
  exploreMass: true,
  exploreDefense: false,
  earlyAttackPressure: -0.19999999999999998,
  finishWinBonus: 1000,
};
