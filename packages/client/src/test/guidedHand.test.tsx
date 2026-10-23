import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Card, DurakEngine } from '@durak/shared';
import { GUIDED_HUZUR, GUIDED_STEPS } from '../game/guidedSteps';
import { previewPlay, type PreviewContext } from '../game/playPreview';
import type { TableCard } from '../game/tableSnapshot';
import { GuidedHand } from '../room/GuidedHand';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

// jsdom has no modal dialog support.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};

const c = (suit: string, rank: number): TableCard => ({
  suit,
  rank,
  isJoker: rank > 16,
  key: `${suit}:${rank}:${rank > 16 ? 1 : 0}`,
});
const base: PreviewContext = {
  attacks: [],
  table: [],
  huzurSuit: 'Spades',
  handCounts: [5, 5],
  deckCount: 20,
  targetHandSize: 5,
};

describe('play preview agrees with the shared server validation', () => {
  it('matches the engine for mass attacks and explains the failed condition', () => {
    const pair3 = [c('Hearts', 9), c('Clubs', 9), c('Spades', 12)];
    expect(previewPlay(pair3, base)).toEqual({ kind: 'attack', legal: true });
    expect(previewPlay(pair3, { ...base, handCounts: [5, 2] })?.reason).toBe(
      'Every player needs at least 3 cards for a 3-card mass attack.',
    );
    const noPair = [c('Hearts', 9), c('Clubs', 10), c('Spades', 12)];
    expect(previewPlay(noPair, base)?.reason).toBe('A 3-card mass attack needs at least 1 pair.');
    const five = [c('Hearts', 9), c('Clubs', 9), c('Hearts', 10), c('Clubs', 10), c('Spades', 7)];
    expect(previewPlay(five, base)?.reason).toBe(
      'A 5-card mass attack is allowed once the deck is empty.',
    );
    expect(previewPlay(five, { ...base, deckCount: 0 })?.legal).toBe(true);
    expect(previewPlay(five, { ...base, targetHandSize: 7 })?.legal).toBe(true);
    for (const cards of [pair3, noPair, five]) {
      const engine = DurakEngine.isValidMassAttackForHandCounts(
        cards.map((x) => new Card(x.suit, x.rank, x.isJoker)),
        [...base.handCounts],
        base.deckCount,
        base.targetHandSize,
      );
      expect(previewPlay(cards, base)?.legal).toBe(engine);
    }
  });

  it('requires an added rank when cards are already on the table', () => {
    const table = [c('Hearts', 9)];
    expect(previewPlay([c('Clubs', 9)], { ...base, table })?.legal).toBe(true);
    expect(previewPlay([c('Clubs', 10)], { ...base, table })?.reason).toBe(
      'Add a rank that is already on the table.',
    );
  });

  it('counts missing defenders before checking the assignment', () => {
    const attacks = [c('Hearts', 9), c('Hearts', 10)];
    expect(previewPlay([c('Hearts', 13)], { ...base, attacks })?.reason).toBe(
      'Select 1 more card: one for each attacking card.',
    );
  });
});

describe('guided hand', () => {
  it('scripts four interactions whose intended moves pass shared validation', () => {
    const intended = [c('Hearts', 9), c('Diamonds', 12), c('Spades', 7), null];
    GUIDED_STEPS.forEach((step, i) => {
      const context = { ...base, attacks: step.attacks, huzurSuit: GUIDED_HUZUR };
      const move = intended[i];
      if (move) expect(previewPlay([move], context)?.legal).toBe(true);
      // Every defense step also contains a wrong card that is rejected.
      if (step.attacks.length && step.goal === 'play')
        expect(step.hand.some((card) => !previewPlay([card], context)?.legal)).toBe(true);
      // Nothing in the pick-up step can defend.
      if (step.goal === 'pickup')
        expect(step.hand.every((card) => !previewPlay([card], context)?.legal)).toBe(true);
    });
  });

  it('walks through select, defend, trump and pick up, then returns', () => {
    const close = vi.fn();
    render(<GuidedHand close={close} finishLabel="Back to the table" />);
    fireEvent.click(screen.getByRole('button', { name: 'Select 9 of Hearts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play cards' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Select 8 of Diamonds' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Each card must beat/);
    expect(screen.getByRole('button', { name: 'Defend' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Pick up' }));
    expect(screen.getByRole('status')).toHaveTextContent('You can beat this one.');
    fireEvent.click(screen.getByRole('button', { name: 'Select 8 of Diamonds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Queen of Diamonds' }));
    expect(screen.getByRole('status')).toHaveTextContent('Queen of Diamonds beats 10 of Diamonds');
    fireEvent.click(screen.getByRole('button', { name: 'Defend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Select 7 of Spades' }));
    fireEvent.click(screen.getByRole('button', { name: 'Defend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Pick up' }));
    expect(screen.getByRole('status')).toHaveTextContent('Picked up.');
    fireEvent.click(screen.getByRole('button', { name: 'Back to the table' }));
    expect(close).toHaveBeenCalled();
  });
});
