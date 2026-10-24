import type { BotAttackModel } from './BotAttackModel';

// Promoted by outcome-only self-play after fresh holdout and stress evaluation.
export const DUEL_LEARNED_ATTACK_MODEL: BotAttackModel | null = {
  id: 'duel-learned',
  weights: [
    4.202937432621295, -56.60288230601153, 7.42645797959659, 27.832065031922703, 37.58441761729655,
    -26.63725462371258, 62.69907990186049, 74.47506809206999, 77.61187679037269,
    -26.364397853106986,
  ],
};
