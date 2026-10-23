import type { TableCard } from './tableSnapshot';

const card = (suit: string, rank: number): TableCard => ({
  suit,
  rank,
  isJoker: rank > 16,
  key: `${suit}:${rank}:${rank > 16 ? 1 : 0}`,
});

export interface GuidedStep {
  readonly title: string;
  readonly lesson: string;
  readonly hand: readonly TableCard[];
  readonly attacks: readonly TableCard[];
  /** The step is complete by confirming a legal play, or by picking up. */
  readonly goal: 'play' | 'pickup';
  readonly done: string;
}

// Huzur (trump) is Spades throughout. Ranks: 7–K, then 3, 2, Ace; Jokers above all.
export const GUIDED_HUZUR = 'Spades';
export const GUIDED_STEPS: readonly GuidedStep[] = [
  {
    title: 'Select, check, confirm',
    lesson:
      'Choose a card to lead. Nothing is played until you confirm. Our deck runs 7 to King, then 3, 2 and Ace, and two Jokers beat everything.',
    hand: [card('Hearts', 9), card('Clubs', 13), card('Diamonds', 14), card('Spades', 7)],
    attacks: [],
    goal: 'play',
    done: 'Played. Your card is now the attack on the next player clockwise.',
  },
  {
    title: 'Defend',
    lesson:
      'You are attacked with the 10 of Diamonds. Beat it with a higher card of the same suit.',
    hand: [card('Diamonds', 8), card('Diamonds', 12), card('Clubs', 9), card('Hearts', 7)],
    attacks: [card('Diamonds', 10)],
    goal: 'play',
    done: 'Beaten. In this game your defense then attacks the next player, clockwise around the table.',
  },
  {
    title: 'Use the Huzur',
    lesson:
      'The Huzur sets the trump suit, Spades here. Any trump beats any card of another suit, even an Ace.',
    hand: [card('Hearts', 13), card('Clubs', 9), card('Spades', 7), card('Diamonds', 10)],
    attacks: [card('Hearts', 16)],
    goal: 'play',
    done: 'The 7 of trump beat an Ace.',
  },
  {
    title: 'Pick up',
    lesson: 'Nothing beats the Red Joker. When you cannot defend, pick up the table instead.',
    hand: [card('Spades', 15), card('Hearts', 13), card('Clubs', 8)],
    attacks: [card('None', 18)],
    goal: 'pickup',
    done: 'Picked up. The cards join your hand and play moves on.',
  },
];
