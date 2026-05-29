import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { GameState } from '@durak/shared/src/state/GameState';
import { Player } from '@durak/shared/src/state/Player';
import { Card } from '@durak/shared/src/state/Card';

describe('Suhuh first-turn draw (#123)', () => {
  let room: DurakRoom;

  beforeEach(() => {
    room = new DurakRoom();
    room.state = new GameState();
    room.broadcast = vi.fn();
    (room as any).startTurnTimer = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupPlayers(ids: string[], teamMap?: Record<string, number>) {
    room.state.seatOrder.splice(0, room.state.seatOrder.length);
    ids.forEach((id) => {
      const p = new Player(id);
      if (teamMap) p.team = teamMap[id] ?? 0;
      room.state.players.set(id, p);
      room.state.seatOrder.push(id);
    });
    room.state.huzurSuit = 'spades';
  }

  function pushDeckTop(...cards: Card[]) {
    // Cards pushed last are popped first (top of deck)
    cards.forEach((c) => room.state.deck.push(c));
  }

  describe('FFA mode', () => {
    it('assigns first turn to the player who drew the highest card', () => {
      setupPlayers(['p1', 'p2', 'p3']);
      // p3 draws first (last pushed = last popped), p2 second, p1 third
      // deck pops: p1 gets 7h, p2 gets Ah (high), p3 gets 9h
      pushDeckTop(new Card('hearts', 7), new Card('hearts', 14), new Card('hearts', 9));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p2'); // Ace of hearts is highest
    });

    it('picks trump over non-trump of the same rank', () => {
      setupPlayers(['p1', 'p2']);
      // pop order: p1 gets last element, p2 gets second-to-last
      // p1 draws 9s (trump), p2 draws 9h (non-trump)
      pushDeckTop(new Card('hearts', 9), new Card('spades', 9));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p1');
    });

    it('picks joker over all other cards', () => {
      setupPlayers(['p1', 'p2', 'p3']);
      pushDeckTop(new Card('hearts', 14), new Card('none', 1, true), new Card('spades', 14));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p2'); // p2 draws joker
    });

    it('drawn cards are NOT added to player hands (suhuh uses a separate draw)', () => {
      setupPlayers(['p1', 'p2']);
      pushDeckTop(new Card('clubs', 8), new Card('clubs', 10));

      (room as any).resolveSuhuh();

      expect(room.state.players.get('p1')!.hand.length).toBe(0);
      expect(room.state.players.get('p2')!.hand.length).toBe(0);
    });

    it('drawn cards are returned to the deck so deck size is preserved', () => {
      setupPlayers(['p1', 'p2']);
      pushDeckTop(new Card('clubs', 8), new Card('clubs', 10));

      expect(room.state.deck.length).toBe(2);
      (room as any).resolveSuhuh();
      expect(room.state.deck.length).toBe(2);
    });

    it('logs suhuh draws to the action log', () => {
      setupPlayers(['p1', 'p2']);
      pushDeckTop(new Card('hearts', 7), new Card('hearts', 9));

      (room as any).resolveSuhuh();

      const log = Array.from(room.state.actionLog).filter((e): e is string => e != null);
      expect(log.some((entry) => entry.startsWith('suhuh p1'))).toBe(true);
      expect(log.some((entry) => entry.startsWith('suhuh p2'))).toBe(true);
      expect(log.some((entry) => entry.startsWith('suhuh first:'))).toBe(true);
    });
  });

  describe('teams mode', () => {
    it("only one rep per team draws; winning team's first seat-order player starts", () => {
      room.state.mode = 'teams';
      setupPlayers(['p1', 'p2', 'p3', 'p4'], { p1: 0, p2: 1, p3: 0, p4: 1 });
      // team 0 rep = p1, team 1 rep = p2
      // pop order: team 0 rep (p1) gets last element, team 1 rep (p2) gets next
      // p1 draws 7c, p2 draws Ac — team 1 wins, p2 is team 1's first in seat order
      pushDeckTop(new Card('clubs', 14), new Card('clubs', 7));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p2');
    });

    it('team 0 wins when their rep draws higher', () => {
      room.state.mode = 'teams';
      setupPlayers(['p1', 'p2', 'p3', 'p4'], { p1: 0, p2: 1, p3: 0, p4: 1 });
      // pop order: team 0 rep (p1) gets last element, team 1 rep (p2) gets next
      // p1 draws As (trump), p2 draws Kh — team 0 wins
      pushDeckTop(new Card('hearts', 13), new Card('spades', 14));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p1');
    });
  });

  describe('suit hierarchy tie-breakers', () => {
    it('applies spades > hearts > clubs > diamonds for non-trumps of equal rank (trump is diamonds)', () => {
      setupPlayers(['p1', 'p2', 'p3']);
      room.state.huzurSuit = 'diamonds';

      // Pop order:
      // p1 draws Spades 10 (Trump rank 10)
      // p2 draws Clubs 10
      // p3 draws Hearts 10
      // Spades is strongest non-trump, so p1 wins
      pushDeckTop(new Card('hearts', 10), new Card('clubs', 10), new Card('spades', 10));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p1');
    });

    it('ranks trump higher than default spades ranking (trump is clubs)', () => {
      setupPlayers(['p1', 'p2']);
      room.state.huzurSuit = 'clubs';

      // Pop order:
      // p1 draws Clubs 10 (trump)
      // p2 draws Spades 10 (non-trump)
      // Clubs is trump, so Clubs 10 beats Spades 10 (p1 wins)
      pushDeckTop(new Card('spades', 10), new Card('clubs', 10));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p1');
    });

    it('falls back to spades > hearts > clubs > diamonds when ranks tie and trump is not drawn (trump is diamonds)', () => {
      setupPlayers(['p1', 'p2']);
      room.state.huzurSuit = 'diamonds';

      // Pop order:
      // p1 draws Clubs 10 (strength 1)
      // p2 draws Hearts 10 (strength 2)
      // Hearts (2) > Clubs (1) (p2 wins)
      pushDeckTop(new Card('hearts', 10), new Card('clubs', 10));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p2');
    });
  });

  describe('fallback when deck is empty', () => {
    it('falls back to lowest-trump-in-hand when deck is empty after deal', () => {
      setupPlayers(['p1', 'p2']);
      // No cards in deck
      const p1 = room.state.players.get('p1')!;
      const p2 = room.state.players.get('p2')!;
      p1.hand.push(new Card('spades', 7)); // trump 7
      p2.hand.push(new Card('spades', 9)); // trump 9 — p1 has lower trump so p1 starts
      p2.hand.push(new Card('hearts', 14));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p1'); // lowest trump wins the first attack
    });

    it('falls back to first player when no trump in hand either', () => {
      setupPlayers(['p1', 'p2']);
      // No deck, no trump cards
      room.state.players.get('p1')!.hand.push(new Card('hearts', 7));
      room.state.players.get('p2')!.hand.push(new Card('clubs', 9));

      const { firstId } = (room as any).resolveSuhuh();
      expect(firstId).toBe('p1'); // first in seat order
    });
  });
});
