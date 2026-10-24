import { BotPolicy } from './BotPolicy';

// Promoted by the six-player bot lab after holdout evaluation.
export const CHAMPION_POLICY: BotPolicy = {
  id: 'champion',
  trumpCost: 1,
  jokerCost: 1,
  attackCostScale: 0.85,
  attackPressure: 1,
  massBonus: 2.5,
  endgameDump: 5,
  defensePressure: 1,
  pickupValue: 1,
  exploreMass: true,
  exploreDefense: false,
};
