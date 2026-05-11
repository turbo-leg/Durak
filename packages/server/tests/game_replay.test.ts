import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { GameState } from '@durak/shared/src/state/GameState';
import { Player } from '@durak/shared/src/state/Player';
import { Card } from '@durak/shared/src/state/Card';
import { Client } from 'colyseus';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRoom() {
  const room = new DurakRoom();
  room.state = new GameState();
  room.broadcast = vi.fn();
  (room as any).startTurnTimer = vi.fn();
  (room as any).scheduleBotTurn = vi.fn();
  return room;
}

function setupPlayers(room: DurakRoom, ids: string[]) {
  room.state.seatOrder.splice(0, room.state.seatOrder.length);
  ids.forEach((id) => {
    const p = new Player(id);
    room.state.players.set(id, p);
    room.state.seatOrder.push(id);
  });
  room.state.hostId = ids[0]!;
  room.state.huzurSuit = 'Spades';
}

function fakeClient(id: string): Client {
  return { sessionId: id, send: vi.fn() } as unknown as Client;
}

/**
 * Controlled 14-card deck for deterministic 2-player tests.
 * Suits must match the Suit enum: 'Spades', 'Hearts', 'Clubs', 'Diamonds'.
 * Ranks follow the engine: 7–13 are face values; 14=3, 15=2, 16=A.
 *
 * Push order → deck[0] = first pushed (huzur), deck[13] = last pushed (dealt first).
 * pop() deals from the high end:
 *   p1 gets: deck[13..9]  → 3♣ K♣ Q♣ J♣ 10♣
 *   p2 gets: deck[8..4]   → 3♥ K♥ Q♥ J♥ 10♥
 *   p1 suhuh: deck[3]     → 9♠ (trump)
 *   p2 suhuh: deck[2]     → 9♥ (non-trump) — p1 wins suhuh, attacks first
 *   remaining: deck[0..1] → 7♠ (huzur) + 8♥ (draw reserve)
 */
function controlledDeck(): Card[] {
  return [
    new Card('Spades', 7), // [0] huzur
    new Card('Hearts', 8), // [1] draw reserve
    new Card('Hearts', 9), // [2] p2 suhuh (non-trump)
    new Card('Spades', 9), // [3] p1 suhuh (trump 9 > hearts 9 → p1 attacks first)
    new Card('Hearts', 10), // [4] p2 hand[4]
    new Card('Hearts', 11), // [5] p2 hand[3]
    new Card('Hearts', 12), // [6] p2 hand[2]
    new Card('Hearts', 13), // [7] p2 hand[1]
    new Card('Hearts', 14), // [8] p2 hand[0] — 3♥ (rank 14)
    new Card('Clubs', 10), // [9]  p1 hand[4]
    new Card('Clubs', 11), // [10] p1 hand[3]
    new Card('Clubs', 12), // [11] p1 hand[2]
    new Card('Clubs', 13), // [12] p1 hand[1]
    new Card('Clubs', 14), // [13] p1 hand[0] — 3♣ (dealt first)
  ];
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('Game loop regression (#119)', () => {
  let room: DurakRoom;

  beforeEach(() => {
    room = makeRoom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── game-over detection ──────────────────────────────────────────────────

  describe('game-over detection', () => {
    beforeEach(() => {
      setupPlayers(room, ['p1', 'p2']);
      room.state.phase = 'playing';
    });

    it('declares the remaining player as loser when deck is empty and one hand empties', () => {
      room.state.deck.splice(0, room.state.deck.length);
      // Both players have cards — not finished yet
      room.state.players.get('p1')!.hand.push(new Card('Clubs', 7));
      room.state.players.get('p2')!.hand.push(new Card('Hearts', 7));

      (room as any).checkGameOver();

      expect(room.state.phase).toBe('playing'); // still ongoing

      // p1 empties their hand → p1 wins, p2 is the loser
      room.state.players.get('p1')!.hand.splice(0, 1);

      (room as any).checkGameOver();

      expect(room.state.phase).toBe('finished');
      expect(Array.from(room.state.winners)).toContain('p1');
      expect(room.state.loser).toBe('p2');
    });

    it('does not trigger while deck still has cards even if a hand is empty', () => {
      room.state.deck.push(new Card('clubs', 7)); // deck not empty

      (room as any).checkGameOver();

      expect(room.state.phase).toBe('playing');
      expect(room.state.winners.length).toBe(0);
    });

    it('handles draw: both hands empty simultaneously', () => {
      room.state.deck.splice(0, room.state.deck.length);
      // both hands already empty

      (room as any).checkGameOver();

      expect(room.state.phase).toBe('finished');
      expect(Array.from(room.state.winners)).toContain('p1');
      expect(Array.from(room.state.winners)).toContain('p2');
      expect(room.state.loser).toBe(''); // no single loser
      expect(room.broadcast).toHaveBeenCalledWith('gameOver', { loser: null, draw: true });
    });
  });

  // ── replay integrity ─────────────────────────────────────────────────────

  describe('replay integrity', () => {
    it('deck resets to 30 cards after replay (regression: unshift bug caused 67)', () => {
      setupPlayers(room, ['p1', 'p2']);
      (room as any).startGame();

      // Force game over
      room.state.phase = 'finished';
      room.state.deck.splice(0, room.state.deck.length);

      // Replay
      (room as any).resetGameStateForReplay();
      (room as any).startGame();

      // 42 deck cards − 5×2 dealt − 2 suhuh draws = 30
      expect(room.state.deck.length).toBe(30);
    });

    it('multiple consecutive replays keep correct deck size', () => {
      setupPlayers(room, ['p1', 'p2']);

      for (let i = 0; i < 3; i++) {
        (room as any).startGame();
        room.state.phase = 'finished';
        (room as any).resetGameStateForReplay();
      }
      (room as any).startGame();

      expect(room.state.deck.length).toBe(30);
    });

    it('player hands are cleared and re-dealt on replay', () => {
      setupPlayers(room, ['p1', 'p2']);
      (room as any).startGame();

      const p1HandAfterGame1 = Array.from(room.state.players.get('p1')!.hand).map((c: any) => ({
        suit: c.suit,
        rank: c.rank,
      }));

      room.state.phase = 'finished';
      (room as any).resetGameStateForReplay();
      (room as any).startGame();

      const p1 = room.state.players.get('p1')!;
      // Each player gets 5 dealt + 1 suhuh = 6 cards after start
      expect(p1.hand.length).toBe(6);
      // hasPickedUp and pickedUpCardKeys reset
      expect(p1.hasPickedUp).toBe(false);
      expect(p1.pickedUpCardKeys.length).toBe(0);

      // Sanity: hand is different from game 1 (different shuffle) — not guaranteed,
      // but we can confirm it's a non-trivial 6-card hand
      expect(p1.hand.length).toBeGreaterThan(0);
      void p1HandAfterGame1; // referenced to avoid unused warning
    });

    it('huzurCard and huzurSuit are populated after replay', () => {
      setupPlayers(room, ['p1', 'p2']);
      (room as any).startGame();

      room.state.phase = 'finished';
      (room as any).resetGameStateForReplay();
      (room as any).startGame();

      expect(room.state.huzurCard).toBeTruthy();
      expect(['Spades', 'Hearts', 'Diamonds', 'Clubs']).toContain(room.state.huzurSuit);
      // huzur card must still be in deck (deck[0] peek, not popped)
      const huzur = room.state.huzurCard;
      const deckCard = room.state.deck[0];
      expect(deckCard?.suit).toBe(huzur.suit);
      expect(deckCard?.rank).toBe(huzur.rank);
    });

    it('winners and loser are cleared on replay', () => {
      setupPlayers(room, ['p1', 'p2']);
      (room as any).startGame();

      room.state.winners.push('p1');
      room.state.loser = 'p2';
      room.state.phase = 'finished';

      (room as any).resetGameStateForReplay();
      (room as any).startGame();

      expect(Array.from(room.state.winners).length).toBe(0);
      expect(room.state.loser).toBe('');
    });

    it('phase is playing after replay', () => {
      setupPlayers(room, ['p1', 'p2']);
      (room as any).startGame();

      room.state.phase = 'finished';
      (room as any).resetGameStateForReplay();
      (room as any).startGame();

      expect(room.state.phase).toBe('playing');
    });
  });

  // ── controlled-deck round mechanics ──────────────────────────────────────

  describe('round mechanics (controlled deck)', () => {
    beforeEach(() => {
      setupPlayers(room, ['p1', 'p2']);
      (room as any).testModeDeck = controlledDeck();
      (room as any).startGame();
      // p1 wins suhuh (9♠ trump > 9♥) and attacks first
    });

    it('attack places a card on activeAttackCards and removes it from hand', () => {
      expect(room.state.currentTurn).toBe('p1');
      const p1 = room.state.players.get('p1')!;
      const p1HandBefore = p1.hand.length;

      // p1 attacks with 3♣ (rank 14, Clubs — the first card dealt)
      (room as any).handleAttack(fakeClient('p1'), {
        cards: [{ suit: 'Clubs', rank: 14, isJoker: false }],
      });

      expect(room.state.activeAttackCards.length).toBe(1);
      expect(room.state.activeAttackCards[0]!.rank).toBe(14);
      expect(p1.hand.length).toBe(p1HandBefore - 1);
      expect(room.state.currentTurn).toBe('p2');
    });

    it('attack is rejected when card is not in hand', () => {
      const p1Client = fakeClient('p1');

      (room as any).handleAttack(p1Client, {
        cards: [{ suit: 'Spades', rank: 14, isJoker: false }], // p1 has no 3♠
      });

      expect(p1Client.send as any).toHaveBeenCalledWith('error', 'You do not have those cards.');
      expect(room.state.activeAttackCards.length).toBe(0);
    });

    it('pickup: defender receives all active + table cards', () => {
      // p1 attacks with 3♣ (Clubs, non-trump — p2 has only Hearts, cannot beat)
      (room as any).handleAttack(fakeClient('p1'), {
        cards: [{ suit: 'Clubs', rank: 14, isJoker: false }],
      });
      expect(room.state.currentTurn).toBe('p2');

      const p2 = room.state.players.get('p2')!;
      const p2HandBefore = p2.hand.length;

      (room as any).handlePickUp(fakeClient('p2'));

      expect(room.state.activeAttackCards.length).toBe(0);
      expect(room.state.table.length).toBe(0);
      // p2 received the 1 active attack card
      expect(p2.hand.length).toBe(p2HandBefore + 1);
      // turn advances back to p1 after pickup
      expect(room.state.currentTurn).toBe('p1');
    });

    it('pickup is rejected when there is nothing to pick up', () => {
      expect(room.state.activeAttackCards.length).toBe(0);
      const p2Client = fakeClient('p2');

      // Set currentTurn to p2 to bypass turn check
      room.state.currentTurn = 'p2';
      (room as any).handlePickUp(p2Client);

      expect(p2Client.send as any).toHaveBeenCalledWith('error', 'Nothing to pick up.');
    });

    it('defend: successful defense moves cards through hot-potato chain', () => {
      // p1 attacks with 3♣ (Clubs, non-trump)
      (room as any).handleAttack(fakeClient('p1'), {
        cards: [{ suit: 'Clubs', rank: 14, isJoker: false }],
      });

      // Inject 3♠ (trump) into p2's hand so they can beat 3♣
      const p2 = room.state.players.get('p2')!;
      p2.hand.push(new Card('Spades', 14)); // 3♠ (trump) — beats 3♣

      const p2HandBefore = p2.hand.length;
      (room as any).handleDefend(fakeClient('p2'), {
        cards: [{ suit: 'Spades', rank: 14, isJoker: false }],
      });

      // In 2-player game: defenseChainCount >= players.size - 1 = 1 → round ends
      expect(room.state.activeAttackCards.length).toBe(0);
      expect(room.state.table.length).toBe(0); // cleared after chain completes
      expect(room.state.tableStacks.length).toBe(0);
      // Defense card was removed from p2's hand
      expect(p2.hand.length).toBe(p2HandBefore - 1);
      // p2 successfully defended — p2 leads next trick
      expect(room.state.currentTurn).toBe('p2');
    });

    it('defend is rejected when card is not in hand', () => {
      (room as any).handleAttack(fakeClient('p1'), {
        cards: [{ suit: 'Clubs', rank: 14, isJoker: false }],
      });

      const p2Client = fakeClient('p2');
      (room as any).handleDefend(p2Client, {
        cards: [{ suit: 'Spades', rank: 14, isJoker: false }], // p2 has no 3♠
      });

      expect(p2Client.send as any).toHaveBeenCalledWith('error', 'You do not have those cards.');
      expect(room.state.activeAttackCards.length).toBe(1); // still undefended
    });

    it('deck replenishes players below targetHandSize after an attack', () => {
      // Drain p1's hand to 1 card (only A♣ remains) so they draw after attacking
      const p1 = room.state.players.get('p1')!;
      // Remove all but 3♣ (rank 14, Clubs) from p1's hand
      while (p1.hand.length > 1) {
        const idx = Array.from(p1.hand).findIndex(
          (c: any) => !(c.suit === 'Clubs' && c.rank === 14),
        );
        if (idx !== -1) p1.hand.splice(idx, 1);
        else break;
      }
      expect(p1.hand.length).toBe(1);
      const deckBefore = room.state.deck.length;

      (room as any).handleAttack(fakeClient('p1'), {
        cards: [{ suit: 'Clubs', rank: 14, isJoker: false }],
      });

      // p1 played their only card, should draw up to targetHandSize from deck
      // deck has 2 cards (huzur + reserve), so they draw min(2, 5-0) = 2
      expect(p1.hand.length).toBeGreaterThan(0);
      expect(room.state.deck.length).toBeLessThan(deckBefore);
    });
  });

  // ── phase guards ──────────────────────────────────────────────────────────

  describe('phase guards', () => {
    it('rejects attack when game is not in playing phase', () => {
      setupPlayers(room, ['p1', 'p2']);
      room.state.phase = 'waiting';
      room.state.currentTurn = 'p1';
      const p1 = room.state.players.get('p1')!;
      p1.hand.push(new Card('Clubs', 7));

      (room as any).handleAttack(fakeClient('p1'), {
        cards: [{ suit: 'Clubs', rank: 7, isJoker: false }],
      });

      expect(room.state.activeAttackCards.length).toBe(0);
    });

    it('rejects actions from the wrong player', () => {
      setupPlayers(room, ['p1', 'p2']);
      room.state.phase = 'playing';
      room.state.currentTurn = 'p1';
      const p2 = room.state.players.get('p2')!;
      p2.hand.push(new Card('Clubs', 7));

      (room as any).handleAttack(fakeClient('p2'), {
        // p2 tries to attack on p1's turn
        cards: [{ suit: 'Clubs', rank: 7, isJoker: false }],
      });

      expect(room.state.activeAttackCards.length).toBe(0);
    });
  });
});
