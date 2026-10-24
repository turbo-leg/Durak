/** Learned residual over the existing legal-move scorer; trained only from self-play outcomes. */
export interface BotAttackModel {
  id: string;
  weights: number[];
}

export const ATTACK_MODEL_FEATURES = [
  'cards played',
  'card power spent',
  'trumps spent',
  'jokers spent',
  'estimated pickup chance',
  'pickup chance against a short hand',
  'cards shed after deck exhaustion',
  'cards shed while behind',
  'mass attack',
  'immediate finish',
] as const;
