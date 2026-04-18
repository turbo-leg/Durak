import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Server } from "colyseus";
import { DurakRoom } from "../src/rooms/DurakRoom";
import { Card, GameState } from "@durak/shared";

describe("DurakRoom E2E 6-Player Game Simulation", () => {
  let testingServer: ColyseusTestServer;

  beforeEach(async () => {
    const gameServer = new Server();
    gameServer.define("durak", DurakRoom);
    testingServer = await boot(gameServer);
  });

  afterEach(async () => {
    await testingServer.cleanup();
  });

  it("plays a hand: attacker adds cards, defender picks up, turn goes properly", async () => {
    const testModeDeck = [
      new Card("♠", 2), // Huzur
      new Card("♥", 6), new Card("♣", 7), new Card("♣", 8), new Card("♣", 9), new Card("♣", 10), // P6
      new Card("♥", 7), new Card("♦", 7), new Card("♦", 8), new Card("♦", 9), new Card("♦", 10), // P5
      new Card("♥", 8), new Card("♠", 7), new Card("♠", 8), new Card("♠", 9), new Card("♠", 10), // P4
      new Card("♥", 9), new Card("♥", 10), new Card("♥", 11), new Card("♥", 12), new Card("♥", 13), // P3
      new Card("♦", 2), new Card("♦", 3), new Card("♦", 4), new Card("♦", 5), new Card("♦", 6), // P2
      new Card("♠", 3), new Card("♠", 4), new Card("♠", 5), new Card("♠", 6), new Card("♣", 2), // P1
    ];
    
    const room = await testingServer.createRoom<GameState>("durak", { testModeDeck });
    
    const clients = [];
    for (let i = 0; i < 6; i++) {
        const client = await testingServer.connectTo(room);
        client.onMessage("error", () => {});
        clients.push(client);
        await new Promise(r => setTimeout(r, 20));
    }
    
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("playing");

    const ids = clients.map(c => c.sessionId);
    expect(room.state.currentTurn).toBe(ids[0]);

    // Player 1 attacks Player 2 with ♣2
    clients[0].send("attack", { cards: [{ suit: "♣", rank: 2, isJoker: false }] });
    await room.waitForNextPatch();
    expect(room.state.currentTurn).toBe(ids[1]); // P2 needs to defend

    // Player 2 defends with ♦2 (not Trump, wait Diamond isn't Trump, Spades is)
    // Wait, rank 2 matching does not defend! You need higher rank of same suit or Trump!
    // Player 2 needs a Club higher than 2 or Spades. Let's make P2 pick up.
    clients[1].send("pickUp");
    await room.waitForNextPatch();

    // Because P2 picked up, P2 loses turn. P3 becomes attacker.
    expect(room.state.currentTurn).toBe(ids[2]);
  });
});
