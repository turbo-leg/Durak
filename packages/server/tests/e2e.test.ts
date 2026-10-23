import { describe, it, beforeAll, afterAll, expect, beforeEach, vi } from 'vitest';
import { ColyseusTestServer, boot } from '@colyseus/testing';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { GameState } from '@durak/shared/src/state/GameState';
import { Card } from '@durak/shared/src/state/Card';

const appConfig = {
  initializeGameServer: (gameServer: any) => {
    gameServer.define('durak', DurakRoom);
  },
  initializeExpress: (app: any) => {},
};

describe('E2E Durak Match', () => {
  let testingServer: ColyseusTestServer;

  beforeAll(async () => {
    testingServer = await boot(appConfig);
  });

  afterAll(async () => {
    await testingServer.cleanup();
  });

  it.each(['easy', 'hard'])(
    'starts a Solo match with a live %s bot from room options',
    async (botDifficulty) => {
      const room = await testingServer.createRoom<GameState>('durak', {
        isPrivate: true,
        maxPlayers: 2,
        handSize: 5,
        mode: 'classic',
        botDifficulty,
        lifecycleTiming: { openingMs: 150 },
      });
      const client = await testingServer.connectTo(room);
      // Practice deals at once, then shows the opening before the first turn.
      await vi.waitFor(() => expect(room.state.phase).toBe('opening'));
      expect(room.state.turnStartTime).toBe(0);
      await vi.waitFor(() => expect(room.state.phase).toBe('playing'));
      expect(room.state.turnStartTime).toBeGreaterThan(0);
      expect(room.state.targetHandSize).toBe(5);
      expect(room.state.players.size).toBe(2);
      expect(room.state.players.get(client.sessionId)?.hand.length).toBe(5);
      const bot = Array.from(room.state.players.values()).find((p) => p.id !== client.sessionId);
      expect(bot?.username).toBe(`Bot (${botDifficulty})`);
      expect(bot?.isReady).toBe(true);
      expect(room.state.seatOrder.length).toBe(2);
    },
  );

  it('spins up server, joins 2 players, starts game, performs attack, defend, and pickup', async () => {
    const room = await testingServer.createRoom<GameState>('durak', {});

    const client1 = await testingServer.connectTo(room);
    const client2 = await testingServer.connectTo(room);

    expect(room.state.players.size).toBe(2);

    client1.send('toggleReady', { isReady: true });
    client2.send('toggleReady', { isReady: true });
    await room.waitForNextPatch();

    client1.send('startGame');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('playing');
    expect(room.state.deck.length).toBeGreaterThan(0);

    const attackerId = room.state.currentTurn;
    const attackerClient = attackerId === client1.sessionId ? client1 : client2;
    const defenderClient = attackerId === client1.sessionId ? client2 : client1;

    const attackerPlayer = room.state.players.get(attackerClient.sessionId)!;
    const defenderPlayer = room.state.players.get(defenderClient.sessionId)!;

    // ----- ATTACK -----
    // Lead with a non-Joker so the Red Joker below can always beat it.
    const cardToPlay = Array.from(attackerPlayer.hand).find((c) => c && !c.isJoker);
    if (!cardToPlay) throw new Error('Expected the attacker to have a dealt card');
    attackerClient.send('attack', { cards: [cardToPlay] });
    await room.waitForNextPatch();

    expect(room.state.activeAttackCards.length).toBe(1);
    expect(room.state.activeAttackCards[0]?.rank).toBe(cardToPlay.rank);
    expect(room.state.currentTurn).toBe(defenderClient.sessionId);

    // ----- DEFEND -----
    // Cheat the Red Joker into defender's hand so they can beat any non-Joker lead
    const defenseCard = new Card('None', 18, true);
    defenderPlayer.hand.push(defenseCard);

    defenderClient.send('defend', {
      cards: [{ suit: defenseCard.suit, rank: defenseCard.rank, isJoker: defenseCard.isJoker }],
    });
    // Three patches: defensePlayed broadcast flushes an intermediate patch, then
    // roundDiscarded flushes another, then endRound clears the table in the final patch.
    await room.waitForNextPatch();
    await room.waitForNextPatch();
    await room.waitForNextPatch();

    // activeAttackCards should now be cleared / moved to table

    // According to DurakRoom.ts, after a successful defense in a 2-player game,
    // the round ends because defenseChainCount >= 1.
    // The table is cleared, and the defender gets to start the next trick.
    expect(room.state.activeAttackCards.length).toBe(0);
    expect(room.state.table.length).toBe(0);
    expect(room.state.tableStacks.length).toBe(0);

    // Turn is defender's (who successfully defended and leads the next trick)
    expect(room.state.currentTurn).toBe(defenderClient.sessionId);

    // ----- SECOND ATTACK (Defender starts a new trick) -----
    const cardToPlay2 = defenderPlayer.hand[0];
    if (!cardToPlay2) throw new Error('Expected the defender to have a replenished card');
    defenderClient.send('attack', { cards: [cardToPlay2] });
    await room.waitForNextPatch();

    expect(room.state.activeAttackCards.length).toBe(1);
    expect(room.state.activeAttackCards[0]?.rank).toBe(cardToPlay2.rank);

    // Now it's the other player's turn (attackerClient). They pick up!
    const attackerHandSizeBefore = attackerPlayer.hand.length;
    attackerClient.send('pickUp');
    await room.waitForNextPatch();

    // The attacker picks up the single activeAttackCard
    expect(room.state.table.length).toBe(0);
    expect(room.state.activeAttackCards.length).toBe(0);
    expect(attackerPlayer.hand.length).toBe(attackerHandSizeBefore + 1);

    // Next turn remains with the defender since attacker picked up
    expect(room.state.currentTurn).toBe(defenderClient.sessionId);
  });
});
