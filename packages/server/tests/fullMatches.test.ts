import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card, GameState, Player } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { BotEngine } from '../src/ai/BotEngine';

// Exercise the real room setup, real bot decisions and real action handlers,
// without wall-clock think delays or database dependencies.
describe('complete custom-rule matches', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['classic', 2, 5],
    ['classic', 2, 7],
    ['classic', 3, 5],
    ['classic', 3, 7],
    ['classic', 4, 5],
    ['classic', 4, 7],
    ['classic', 5, 5],
    ['classic', 6, 5],
    ['teams', 4, 7],
    ['teams', 6, 5],
    ['horse', 4, 7],
  ] as const)(
    'finishes %s / %i players / %i cards while conserving the deck',
    async (mode, count, handSize) => {
      let seed = 42 + count + handSize;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      });
      const room = new DurakRoom();
      room.state = new GameState();
      room.state.mode = mode;
      room.state.isPrivate = true;
      room.state.targetHandSize = handSize;
      room.broadcast = vi.fn();
      vi.spyOn(room as any, 'startTurnTimer').mockImplementation(() => {});
      vi.spyOn(room as any, 'scheduleBotTurn').mockImplementation(() => {});
      vi.spyOn(room as any, 'saveGameLog').mockResolvedValue(undefined);
      // Horse sub-games use the same core; the meta-match is tested separately.
      vi.spyOn(room as any, 'handleHorseRoundEnd').mockImplementation(() => {});
      for (let i = 0; i < count; i++) room.state.players.set(`p${i}`, new Player(`p${i}`));
      (room as any).startGame();
      const bot = new BotEngine();
      const errors = vi.fn();
      let turns = 0;
      const trace: string[] = [];
      const conserved = () => {
        const cards = [
          ...room.state.deck,
          ...room.state.table,
          ...room.state.activeAttackCards,
          ...room.state.discardPile,
          ...Array.from(room.state.players.values()).flatMap((p) => Array.from(p.hand)),
        ].filter((c): c is Card => !!c);
        expect(cards.length).toBe(42);
        expect(new Set(cards.map((c) => `${c.suit}:${c.rank}:${c.isJoker}`)).size).toBe(42);
      };
      conserved();
      while (room.state.phase === 'playing' && turns++ < 2000) {
        const id = room.state.currentTurn;
        const move = await bot.think(room.state, id, 'hard', room.getOpponentResponseMemory());
        expect(
          move,
          `No move for ${id} at action ${turns}; hand=${room.state.players.get(id)?.hand.length}; deck=${room.state.deck.length}; active=${room.state.activeAttackCards.length}; winners=${Array.from(room.state.winners)}; trace=${trace.join(' / ')}`,
        ).not.toBeNull();
        trace.push(`${id}:${move!.action}:${move!.cards.map((c) => c.suit + c.rank).join(',')}`);
        if (trace.length > 12) trace.shift();
        const client = { sessionId: id, send: errors };
        if (move!.action === 'attack') (room as any).handleAttack(client, { cards: move!.cards });
        if (move!.action === 'defend') (room as any).handleDefend(client, { cards: move!.cards });
        if (move!.action === 'pickup') (room as any).handlePickUp(client);
        if (move!.action === 'swapHuzur') (room as any).handleSwapHuzur(client);
        expect(errors).not.toHaveBeenCalled();
        conserved();
      }
      expect(
        room.state.phase,
        `Match stalled after ${turns} actions; deck=${room.state.deck.length}; hands=${Array.from(room.state.players.values()).map((p) => p.id + ':' + p.hand.length)}; trace=${trace.join(' / ')}`,
      ).toBe('finished');
      expect(room.state.deck.length).toBe(0);
      expect(room.state.winners.length).toBeGreaterThan(0);
    },
  );
});
