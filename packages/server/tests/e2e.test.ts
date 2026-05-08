import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'vitest';
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

  it('spins up server, joins 2 players, starts game, performs attack, defend, and pickup', async () => {
    const room = await testingServer.createRoom<GameState>('durak', {});

    const client1 = await testingServer.connectTo(room);
    const client2 = await testingServer.connectTo(room);

    expect(room.state.players.size).toBe(2);

    client1.send('toggleReady', { isReady: true });
    client2.send('toggleReady', { isReady: true });
    await new Promise((resolve) => setTimeout(resolve, 200));

    client1.send('startGame');
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(room.state.phase).toBe('playing');
    expect(room.state.deck.length).toBeGreaterThan(0);

    const attackerId = room.state.currentTurn;
    const attackerClient = attackerId === client1.sessionId ? client1 : client2;
    const defenderClient = attackerId === client1.sessionId ? client2 : client1;

    const attackerPlayer = room.state.players.get(attackerClient.sessionId)!;
    const defenderPlayer = room.state.players.get(defenderClient.sessionId)!;

    // ----- ATTACK -----
    const cardToPlay = attackerPlayer.hand[0];
    attackerClient.send('attack', { cards: [cardToPlay] });
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log('activeAttackCards:', room.state.activeAttackCards.toJSON());
    console.log('table:', room.state.table.toJSON());
    console.log('tableStacks:', room.state.tableStacks.toJSON());
    expect(room.state.activeAttackCards.length).toBe(1);
    expect(room.state.activeAttackCards[0].rank).toBe(cardToPlay.rank);
    expect(room.state.currentTurn).toBe(defenderClient.sessionId);

    // ----- DEFEND -----
    const trumpSuit = room.state.huzurSuit;
    // Cheat a Joker into defender's hand so they can beat anything
    const defenseCard = new Card(trumpSuit, 15, true);
    defenderPlayer.hand.push(defenseCard);

    defenderClient.send('defend', {
      cards: [{ suit: defenseCard.suit, rank: defenseCard.rank, isJoker: defenseCard.isJoker }],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // activeAttackCards should now be cleared / moved to table

    console.log('activeAttackCards:', room.state.activeAttackCards.toJSON());
    console.log('table:', room.state.table.toJSON());
    console.log('tableStacks:', room.state.tableStacks.toJSON());

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
    defenderClient.send('attack', { cards: [cardToPlay2] });
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log('activeAttackCards:', room.state.activeAttackCards.toJSON());
    expect(room.state.activeAttackCards.length).toBe(1);
    expect(room.state.activeAttackCards[0].rank).toBe(cardToPlay2.rank);

    // Now it's the other player's turn (attackerClient). They pick up!
    const attackerHandSizeBefore = attackerPlayer.hand.length;
    attackerClient.send('pickUp');
    await new Promise((resolve) => setTimeout(resolve, 200));

    // The attacker picks up the single activeAttackCard
    expect(room.state.table.length).toBe(0);
    expect(room.state.activeAttackCards.length).toBe(0);
    expect(attackerPlayer.hand.length).toBe(attackerHandSizeBefore + 1);

    // Next turn remains with the defender since attacker picked up
    expect(room.state.currentTurn).toBe(defenderClient.sessionId);
  });
});
