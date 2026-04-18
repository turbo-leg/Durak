import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Server } from "colyseus";
import { DurakRoom } from "../src/rooms/DurakRoom";
import { DurakEngine, Card, GameState } from "@durak/shared";

describe("DurakRoom E2E Full Game Simulation", () => {
  let testingServer: ColyseusTestServer;

  beforeEach(async () => {
    const gameServer = new Server();
    gameServer.define("durak", DurakRoom);
    
    // Boot up colyseus test harness
    testingServer = await boot(gameServer);
  });

  afterEach(async () => {
    // Cleanup harness
    await testingServer.cleanup();
  });

  it("plays a full game of Durak between two players and asserts win conditions", async () => {
    // 1. Create a predefined deterministic deck
    // We only need a few cards to force a quick game end
    // E.g., deck size = 11 cards total:
    // User1: 5 cards
    // User2: 5 cards
    // Huzur card: 1 card
    
    const fakeHuzurCard = new Card("♠", 11); // Jack of Spades

    // We want User 1 to have the lowest Trump (e.g. 6 of Spades) to guarantee they go first
    const deck = [
      // 5 cards for User 2 (dealt sequentially)
      new Card("♥", 6), new Card("♥", 7), new Card("♥", 8), new Card("♥", 9), new Card("♥", 10),
      
      // 5 cards for User 1 (they also get a 6 of Spades, making them first attacker)
      // Since map order is insertion order, User 1 gets cards first. 
      new Card("♠", 6), new Card("♣", 6), new Card("♣", 7), new Card("♣", 8), new Card("♣", 9),

      // 1 card for Huzur (pop() gets this first in onCreate)
      fakeHuzurCard,
    ];
    
    // 2. Connect two clients
    const room = await testingServer.createRoom<GameState>("durak", { testModeDeck: deck });
    const client1 = await testingServer.connectTo(room, { /* metadata */ });
    const client2 = await testingServer.connectTo(room, { /* metadata */ });

    // Silence warnings about missing server messages
    client1.onMessage("playerWon", () => {});
    client1.onMessage("gameOver", () => {});
    client2.onMessage("playerWon", () => {});
    client2.onMessage("gameOver", () => {});

    // Wait a brief moment for connection events
    await new Promise(resolve => setTimeout(resolve, 50));

    // Wait until room state reports players
    expect(room.state.players.size).toBe(2);

    // 3. Start the game
    client1.send("startGame");
    
    // Give room time to process state patch
    await room.waitForNextPatch();
    
    // Assert Initialization
    expect(room.state.phase).toBe("playing");
    expect(room.state.deck.length).toBe(1); // 11 cards minus 10 dealt cards = 1 (the Huzur card is left at bottom)
    expect(room.state.huzurCard.suit).toBe("♠");

    // Discover the mapped session IDs
    const c1Id = client1.sessionId;
    const c2Id = client2.sessionId;

    // Check first turn (c1Id should be first because of ♠6)
    const turn = room.state.currentTurn;
    expect(turn).toBe(c1Id);

    // Get exact Card objects from User1's Hand
    const u1Hand = room.state.players.get(c1Id)!.hand;
    // We know U1 has ♠6
    
    // Step 4. User 1 Attacks
    client1.send("attack", { cards: [{ suit: "♠", rank: 6, isJoker: false }] });
    await room.waitForNextPatch();

    // Verify attack is live
    expect(room.state.activeAttackCards.length).toBe(1);
    expect(Array.from(room.state.activeAttackCards)[0]?.suit).toBe("♠");
    expect(room.state.players.get(c1Id)?.hand.length).toBe(4); // from 5 -> 4

    // Step 5. User 2 Defends or Passes
    // Unfortunately User 2 has no Spades AND no cards with rank > 6 in Spades since ♠ is Trump
    // Actually User 2 only has Hearts: 6,7,8,9,10
    // Hearts cannot beat Spades (Trump). So User 2 MUST pick up.
    
    client2.send("pickUp");
    await room.waitForNextPatch();

    // After pickup, no cards on table. User 2 has 6 cards. User 1 has 5 cards. Deck is 0.
    expect(room.state.table.length).toBe(0);
    expect(room.state.players.get(c2Id)!.hand.length).toBe(6);
    expect(room.state.players.get(c1Id)!.hand.length).toBe(5); // replenishAll restored their hand to 5!
    expect(room.state.deck.length).toBe(0);

    // Turn goes to next player ... wait, if P2 picked up, they lose their attack turn!
    // So turn remains P1.
    expect(room.state.currentTurn).toBe(c1Id);

    // Step 6. User 1 attacks again with their last 4 cards.
    // They have ♣6, ♣7, ♣8, ♣9.
    // Let's do a single attack first.
    client1.send("attack", { cards: [{ suit: "♣", rank: 6, isJoker: false }] });
    await room.waitForNextPatch();

    // User 2 has Heart 6? Wait, can they beat Club 6 with Heart 6? No, need same suit higher rank or Trump.
    // User 2 has NO Clubs and NO Trumps.
    // User 2 MUST pickup again.
    client2.send("pickUp");
    await room.waitForNextPatch();
    
    expect(room.state.currentTurn).toBe(c1Id); // Turn remains with P1
    
    // P1 attacks again with ♣7
    client1.send("attack", { cards: [{ suit: "♣", rank: 7, isJoker: false }] });
    await room.waitForNextPatch();
    client2.send("pickUp");
    await room.waitForNextPatch();

    // P1 attacks with ♣8
    client1.send("attack", { cards: [{ suit: "♣", rank: 8, isJoker: false }] });
    await room.waitForNextPatch();
    client2.send("pickUp");
    await room.waitForNextPatch();

    // P1 attacks with their FINAL initial card, ♣9
    client1.send("attack", { cards: [{ suit: "♣", rank: 9, isJoker: false }] });
    await room.waitForNextPatch();
    client2.send("pickUp");
    await room.waitForNextPatch();

    // Now P1's hand is just the Jack of Spades they drew! Let's attack with it.
    client1.send("attack", { cards: [{ suit: "♠", rank: 11, isJoker: false }] });
    await room.waitForNextPatch();

    // Since P1 attacked with their last card and deck is empty...
    // WAIT. If P1 plays their last card, do they win instantly? "checkGameOver" runs inside "handleAttack"
    // Let's verify whether P1 already won before P2 defends!
    
    // Check if player won broadcast happened
    expect(room.state.winners.length).toBe(1);
    expect(Array.from(room.state.winners)[0]).toBe(c1Id);
    
    // Since only one player is left, the game should move to "finished" Phase
    expect(room.state.phase).toBe("finished");
    expect(room.state.loser).toBe(c2Id);
  });
});
