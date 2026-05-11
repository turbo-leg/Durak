import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card as UICard } from '../components/Card';
import { Card } from '@durak/shared';

function makeCard(suit: string, rank: number, isJoker = false) {
  return new Card(suit, rank, isJoker);
}

describe('Card component', () => {
  describe('rank display', () => {
    const cases: [string, number, string][] = [
      ['Seven', 7, '7'],
      ['Eight', 8, '8'],
      ['Nine', 9, '9'],
      ['Ten', 10, '10'],
      ['Jack', 11, 'J'],
      ['Queen', 12, 'Q'],
      ['King', 13, 'K'],
      ['Three (rank 14)', 14, '3'],
      ['Two (rank 15)', 15, '2'],
      ['Ace (rank 16)', 16, 'A'],
    ];

    cases.forEach(([label, rank, expected]) => {
      it(`renders ${label} as "${expected}"`, () => {
        const { getAllByText } = render(<UICard card={makeCard('Clubs', rank)} />);
        // rank appears in top-left and bottom-right (rotated)
        expect(getAllByText(expected).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('suit symbols', () => {
    it('renders ♠ for Spades', () => {
      render(<UICard card={makeCard('Spades', 7)} />);
      expect(screen.getAllByText('♠').length).toBeGreaterThanOrEqual(1);
    });

    it('renders ♥ for Hearts', () => {
      render(<UICard card={makeCard('Hearts', 7)} />);
      expect(screen.getAllByText('♥').length).toBeGreaterThanOrEqual(1);
    });

    it('renders ♦ for Diamonds', () => {
      render(<UICard card={makeCard('Diamonds', 7)} />);
      expect(screen.getAllByText('♦').length).toBeGreaterThanOrEqual(1);
    });

    it('renders ♣ for Clubs', () => {
      render(<UICard card={makeCard('Clubs', 7)} />);
      expect(screen.getAllByText('♣').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('jokers', () => {
    it('renders ★ symbol for Black Joker (rank 17)', () => {
      render(<UICard card={makeCard('None', 17, true)} />);
      expect(screen.getAllByText('★').length).toBeGreaterThanOrEqual(1);
    });

    it('renders JK label for Black Joker', () => {
      render(<UICard card={makeCard('None', 17, true)} />);
      expect(screen.getAllByText('JK').length).toBeGreaterThanOrEqual(1);
    });

    it('renders RJ label for Red Joker (rank 18)', () => {
      render(<UICard card={makeCard('None', 18, true)} />);
      expect(screen.getAllByText('RJ').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('interaction', () => {
    it('calls onClick with the card when isPlayable and clicked', async () => {
      const user = userEvent.setup();
      const handler = vi.fn();
      const card = makeCard('Hearts', 12);

      render(<UICard card={card} isPlayable onClick={handler} />);

      const cardEl = screen.getAllByText('Q')[0]!.closest('div[class]')!;
      await user.click(cardEl);

      expect(handler).toHaveBeenCalledWith(card);
    });

    it('does not call onClick when not playable', async () => {
      const user = userEvent.setup();
      const handler = vi.fn();
      const card = makeCard('Spades', 11);

      render(<UICard card={card} isPlayable={false} onClick={handler} />);

      const cardEl = screen.getAllByText('J')[0]!.closest('div[class]')!;
      await user.click(cardEl);

      expect(handler).not.toHaveBeenCalled();
    });

    it('applies cursor-pointer class only when playable', () => {
      const card = makeCard('Clubs', 9);
      const { rerender, container } = render(<UICard card={card} isPlayable />);
      expect(container.firstChild).toHaveClass('cursor-pointer');

      rerender(<UICard card={card} isPlayable={false} />);
      expect(container.firstChild).not.toHaveClass('cursor-pointer');
    });
  });

  describe('compact mode', () => {
    it('renders a smaller card in compact mode', () => {
      const card = makeCard('Hearts', 13);
      const { container } = render(<UICard card={card} compact />);
      // compact uses w-12 h-[72px]
      expect(container.firstChild).toHaveClass('w-12');
    });

    it('still shows rank and suit in compact mode', () => {
      render(<UICard card={makeCard('Diamonds', 10)} compact />);
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('♦').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('className passthrough', () => {
    it('applies extra className to the root element', () => {
      const { container } = render(
        <UICard card={makeCard('Clubs', 7)} className="my-custom-class" />,
      );
      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });
});
