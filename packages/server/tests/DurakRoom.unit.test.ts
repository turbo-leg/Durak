import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { DurakEngine } from '@durak/shared/src/engine/DurakEngine';
import { GameState } from '@durak/shared/src/state/GameState';
import { Player } from '@durak/shared/src/state/Player';
import { Card, Suit } from '@durak/shared/src/state/Card';

/**
 * Unit tests for DurakRoom handlers (issue #190).
 *
 * Unlike e2e.test.ts which boots a full ColyseusTestServer, these tests
 * instantiate DurakRoom directly and invoke the private handlers via
 * `(room as any).handle*`. This keeps each test fast and focused.
 */

type FakeClient = { sessionId: string; send: ReturnType<typeof vi.fn> };

function makeClient(sessionId: string): FakeClient {
  return { sessionId, send: vi.fn() };
}

/** Convert a Card into the plain object the handlers expect via parseCards. */
function asMsg(c: Card) {
  return { suit: c.suit, rank: c.rank, isJoker: c.isJoker };
}

describe('DurakRoom unit handlers (#190)', () => {
  let room: DurakRoom;
  let attacker: FakeClient;
  let defender: FakeClient;
  let third: FakeClient;

  beforeEach(() => {
    room = new DurakRoom();
    room.state = new GameState();
    room.broadcast = vi.fn();
    (room as any).startTurnTimer = vi.fn();
    (room as any).scheduleBotTurn = vi.fn();
    (room as any).logPendingDraws = vi.fn();
    // Avoid the engine drawing replacement cards from the seeded deck.
    vi.spyOn(DurakEngine, 'replenishAll').mockImplementation(() => {});

    attacker = makeClient('atk');
    defender = makeClient('def');
    third = makeClient('thr');

    // Two seated players + trump = Spades.
    const pA = new Player('atk');
    const pD = new Player('def');
    room.state.players.set('atk', pA);
    room.state.players.set('def', pD);
    room.state.seatOrder.push('atk');
    room.state.seatOrder.push('def');
    room.state.huzurSuit = Suit.Spades;
    room.state.phase = 'playing';
    room.state.currentTurn = 'atk';

    // Seed the deck so checkGameOver does NOT auto-declare winners just because
    // a player's hand is empty. Tests that want to exercise game-end explicitly
    // clear the deck themselves.
    for (let i = 0; i < 6; i++) {
      room.state.deck.push(new Card(Suit.Diamonds, 7 + i));
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. handleAttack
  // ──────────────────────────────────────────────────────────────────────
  describe('handleAttack', () => {
    it('valid attack moves card from hand to activeAttackCards and passes turn', () => {
      const card = new Card(Suit.Hearts, 10);
      room.state.players.get('atk')!.hand.push(card);

      (room as any).handleAttack(attacker, { cards: [asMsg(card)] });

      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.activeAttackCards[0].suit).toBe(Suit.Hearts);
      expect(room.state.activeAttackCards[0].rank).toBe(10);
      expect(room.state.players.get('atk')!.hand.length).toBe(0);
      expect(room.state.currentTurn).toBe('def');
    });

    it('rejects attack from non-current-turn player', () => {
      const card = new Card(Suit.Hearts, 10);
      room.state.players.get('def')!.hand.push(card);

      // defender attempts to attack while it's atk's turn
      (room as any).handleAttack(defender, { cards: [asMsg(card)] });

      expect(room.state.activeAttackCards.length).toBe(0);
      expect(room.state.players.get('def')!.hand.length).toBe(1);
      expect(room.state.currentTurn).toBe('atk');
    });

    it("rejects attack with a card not in the player's hand", () => {
      const heldCard = new Card(Suit.Hearts, 10);
      const ghostCard = new Card(Suit.Clubs, 13);
      room.state.players.get('atk')!.hand.push(heldCard);

      (room as any).handleAttack(attacker, { cards: [asMsg(ghostCard)] });

      expect(attacker.send).toHaveBeenCalledWith('error', expect.stringMatching(/do not have/i));
      expect(room.state.activeAttackCards.length).toBe(0);
      expect(room.state.players.get('atk')!.hand.length).toBe(1);
    });

    it('rejects attack when phase !== "playing"', () => {
      room.state.phase = 'waiting';
      const card = new Card(Suit.Hearts, 10);
      room.state.players.get('atk')!.hand.push(card);

      (room as any).handleAttack(attacker, { cards: [asMsg(card)] });

      expect(room.state.activeAttackCards.length).toBe(0);
      expect(room.state.players.get('atk')!.hand.length).toBe(1);
    });

    it('rejects attack with malformed card payload', () => {
      (room as any).handleAttack(attacker, { cards: [{ suit: 'Hearts' /* missing rank */ }] });
      expect(attacker.send).toHaveBeenCalledWith('error', expect.stringMatching(/invalid/i));
      expect(room.state.activeAttackCards.length).toBe(0);
    });

    it('rejects a follow-up attack of a rank not present on the table', () => {
      // simulate prior activeAttackCard of rank 10
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 10));
      const offRankCard = new Card(Suit.Clubs, 13);
      room.state.players.get('atk')!.hand.push(offRankCard);

      (room as any).handleAttack(attacker, { cards: [asMsg(offRankCard)] });

      expect(attacker.send).toHaveBeenCalledWith('error', expect.stringMatching(/rank/i));
      expect(room.state.activeAttackCards.length).toBe(1); // unchanged
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. handleDefend
  // ──────────────────────────────────────────────────────────────────────
  describe('handleDefend', () => {
    beforeEach(() => {
      // Add a 3rd player so the chain doesn't auto-end the round (we want to
      // observe the post-defense state without endRound clearing tables).
      const pT = new Player('thr');
      room.state.players.set('thr', pT);
      room.state.seatOrder.push('thr');
    });

    it('valid defend: higher card of same suit clears activeAttack into table', () => {
      // attack: 8 of hearts; defense: 10 of hearts
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 8));
      room.state.currentTurn = 'def';
      const defCard = new Card(Suit.Hearts, 10);
      room.state.players.get('def')!.hand.push(defCard);

      (room as any).handleDefend(defender, { cards: [asMsg(defCard)] });

      // attack card resolved into table history
      expect(room.state.table.length).toBe(1);
      expect(room.state.table[0].rank).toBe(8);
      // defense card became the new activeAttackCard
      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.activeAttackCards[0].rank).toBe(10);
      expect(room.state.players.get('def')!.hand.length).toBe(0);
    });

    it('valid defend: trump beats non-trump of a different suit', () => {
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 14)); // Ace of hearts
      room.state.currentTurn = 'def';
      const trumpDef = new Card(Suit.Spades, 7); // lowest trump
      room.state.players.get('def')!.hand.push(trumpDef);

      (room as any).handleDefend(defender, { cards: [asMsg(trumpDef)] });

      expect(room.state.table.length).toBe(1);
      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.activeAttackCards[0].suit).toBe(Suit.Spades);
    });

    it('rejects defend with a lower card of the same suit', () => {
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 10));
      room.state.currentTurn = 'def';
      const lowDef = new Card(Suit.Hearts, 7);
      room.state.players.get('def')!.hand.push(lowDef);

      (room as any).handleDefend(defender, { cards: [asMsg(lowDef)] });

      expect(defender.send).toHaveBeenCalledWith('error', expect.stringMatching(/cannot beat/i));
      // state unchanged
      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.activeAttackCards[0].rank).toBe(10);
      expect(room.state.table.length).toBe(0);
      expect(room.state.players.get('def')!.hand.length).toBe(1);
    });

    it('rejects defend with a non-trump card of a different suit', () => {
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 10));
      room.state.currentTurn = 'def';
      const wrongSuit = new Card(Suit.Clubs, 14); // higher rank but wrong suit, not trump
      room.state.players.get('def')!.hand.push(wrongSuit);

      (room as any).handleDefend(defender, { cards: [asMsg(wrongSuit)] });

      expect(defender.send).toHaveBeenCalledWith('error', expect.stringMatching(/cannot beat/i));
      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.table.length).toBe(0);
    });

    it('rejects defend when not the current turn', () => {
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 8));
      // currentTurn is 'atk', defender attempts to defend prematurely... actually
      // the defender IS the player who should defend, but currentTurn=='atk' here.
      const defCard = new Card(Suit.Hearts, 10);
      room.state.players.get('def')!.hand.push(defCard);

      (room as any).handleDefend(defender, { cards: [asMsg(defCard)] });

      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.table.length).toBe(0);
    });

    it('rejects defend when no active attack exists', () => {
      room.state.currentTurn = 'def';
      const defCard = new Card(Suit.Hearts, 10);
      room.state.players.get('def')!.hand.push(defCard);

      (room as any).handleDefend(defender, { cards: [asMsg(defCard)] });

      expect(defender.send).toHaveBeenCalledWith(
        'error',
        expect.stringMatching(/no active attack/i),
      );
    });

    it('rejects defend when cards count does not match attack count', () => {
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 8));
      room.state.activeAttackCards.push(new Card(Suit.Clubs, 8));
      room.state.currentTurn = 'def';
      const defCard = new Card(Suit.Hearts, 10);
      room.state.players.get('def')!.hand.push(defCard);

      (room as any).handleDefend(defender, { cards: [asMsg(defCard)] });

      expect(defender.send).toHaveBeenCalledWith(
        'error',
        expect.stringMatching(/each attacking card/i),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. handlePickUp
  // ──────────────────────────────────────────────────────────────────────
  describe('handlePickUp', () => {
    it('defender picks up all activeAttackCards into hand and turn advances past them', () => {
      // Defender's turn, single active attack card
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 8));
      room.state.currentTurn = 'def';
      const defHandBefore = room.state.players.get('def')!.hand.length;

      (room as any).handlePickUp(defender);

      // pickup empties active attack & table
      expect(room.state.activeAttackCards.length).toBe(0);
      expect(room.state.table.length).toBe(0);
      // defender's hand gained the attack card
      expect(room.state.players.get('def')!.hand.length).toBe(defHandBefore + 1);
      // turn moved away from defender (engine skips defender after pickup via nextTurn)
      expect(room.state.currentTurn).not.toBe('def');
    });

    it('errors when there is nothing to pick up', () => {
      room.state.currentTurn = 'def';
      (room as any).handlePickUp(defender);
      expect(defender.send).toHaveBeenCalledWith(
        'error',
        expect.stringMatching(/nothing to pick up/i),
      );
    });

    it('ignores pickup from non-current-turn player', () => {
      room.state.activeAttackCards.push(new Card(Suit.Hearts, 8));
      room.state.currentTurn = 'def';
      const sizeBefore = room.state.players.get('atk')!.hand.length;

      (room as any).handlePickUp(attacker); // attacker is NOT currentTurn

      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.players.get('atk')!.hand.length).toBe(sizeBefore);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Game end / ELO path
  // ──────────────────────────────────────────────────────────────────────
  describe('Game end', () => {
    it('calls saveGameLog when the last attacking play empties hand and deck is empty', () => {
      const saveSpy = vi.spyOn(room as any, 'saveGameLog').mockResolvedValue(undefined);

      // Empty the seeded deck so winners can be declared.
      room.state.deck.splice(0, room.state.deck.length);

      // Give defender a card so they don't auto-win (only atk should be winner).
      room.state.players.get('def')!.hand.push(new Card(Suit.Clubs, 7));

      // attacker has exactly one card left
      const winningCard = new Card(Suit.Hearts, 10);
      const atkPlayer = room.state.players.get('atk')!;
      atkPlayer.hand.push(winningCard);

      (room as any).handleAttack(attacker, { cards: [asMsg(winningCard)] });

      // After the attack, atk has no cards and deck is empty → atk wins, def is durak
      expect(room.state.winners.length).toBeGreaterThanOrEqual(1);
      expect(Array.from(room.state.winners)).toContain('atk');
      expect(room.state.loser).toBe('def');
      expect(room.state.phase).toBe('finished');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('checkGameOver assigns winner placement and durak placement on game completion', () => {
      const saveSpy = vi.spyOn(room as any, 'saveGameLog').mockResolvedValue(undefined);

      // Two players, deck empty, atk has no cards (already empty), def still has cards
      // This represents the moment atk's last play resolved → win.
      room.state.deck.splice(0, room.state.deck.length);
      room.state.players.get('def')!.hand.push(new Card(Suit.Clubs, 7));
      (room as any).checkGameOver();

      expect(room.state.phase).toBe('finished');
      expect(Array.from(room.state.winners)).toContain('atk');
      expect(room.state.loser).toBe('def');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. onDispose during active game (mid-game persistence)
  // ──────────────────────────────────────────────────────────────────────
  describe('onDispose', () => {
    it('calls saveGameLog when phase === "playing" at dispose time', async () => {
      const saveSpy = vi.spyOn(room as any, 'saveGameLog').mockResolvedValue(undefined);
      room.state.phase = 'playing';

      await (room as any).onDispose();

      expect(saveSpy).toHaveBeenCalled();
    });

    it('does NOT call saveGameLog when phase is waiting (no active game)', async () => {
      const saveSpy = vi.spyOn(room as any, 'saveGameLog').mockResolvedValue(undefined);
      room.state.phase = 'waiting';

      await (room as any).onDispose();

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('does NOT call saveGameLog when game is already finished', async () => {
      const saveSpy = vi.spyOn(room as any, 'saveGameLog').mockResolvedValue(undefined);
      room.state.phase = 'finished';

      await (room as any).onDispose();

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('swallows errors thrown by saveGameLog during dispose', async () => {
      vi.spyOn(room as any, 'saveGameLog').mockRejectedValue(new Error('mongo down'));
      room.state.phase = 'playing';
      // Must not throw
      await expect((room as any).onDispose()).resolves.toBeUndefined();
    });
  });
});
