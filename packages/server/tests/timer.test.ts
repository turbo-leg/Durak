import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DurakRoom } from "../src/rooms/DurakRoom";
import { DurakEngine } from "@durak/shared/src/engine/DurakEngine";
import { GameState } from "@durak/shared/src/state/GameState";
import { Player } from "@durak/shared/src/state/Player";
import { Card } from "@durak/shared/src/state/Card";

describe("DurakRoom Timer Logic", () => {
  let room: DurakRoom;

  beforeEach(() => {
    vi.useFakeTimers();
    room = new DurakRoom();
    room.state = new GameState();
    // mock broadcast
    room.broadcast = vi.fn();
    // mock game over check
    (room as any).checkGameOver = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should trigger auto-pickup when 30 seconds elapse", () => {
    // Setup state
    room.state.phase = "playing";
    room.state.turnTimeLimit = 30000;
    room.state.seatOrder.push("p1", "p2");
    room.state.currentTurn = "p1";
    // give p1 some cards so activeAttackCards triggers pickup
    const player1 = new Player("p1");
    room.state.players.set("p1", player1);
    const player2 = new Player("p2");
    room.state.players.set("p2", player2);
    room.state.activeAttackCards.push(new Card("spades", 10));

    const endRoundSpy = vi.spyOn(DurakEngine, "endRound");

    // Call nextTurn to start timer
    (room as any).nextTurn(); // Passes to p2

    // Fast forward 29 seconds (should not trigger)
    vi.advanceTimersByTime(29000);
    expect(endRoundSpy).not.toHaveBeenCalled();

    // Fast forward 2 more seconds (should trigger pickup)
    vi.advanceTimersByTime(2000);

    expect(room.broadcast).toHaveBeenCalledWith("turnExpired", { playerId: "p2" });
    expect(endRoundSpy).toHaveBeenCalledWith(room.state, "p2");
  });

  it("should reset the timer when the turn passes before 30 seconds", () => {
    room.state.phase = "playing";
    room.state.turnTimeLimit = 30000;
    room.state.seatOrder.push("p1", "p2");
    room.state.currentTurn = "p1";
    
    room.state.players.set("p1", new Player("p1"));
    room.state.players.set("p2", new Player("p2"));
    room.state.activeAttackCards.push(new Card("spades", 10));

    const endRoundSpy = vi.spyOn(DurakEngine, "endRound");

    // Start timer for p2
    (room as any).nextTurn();

    // Wait 15 seconds
    vi.advanceTimersByTime(15000);

    // Call nextTurn again to simulate p2 playing quickly and passing to p1
    (room as any).nextTurn();

    // Fast forward another 20 seconds. Total time 35 seconds. 
    // BUT since we passed the turn at 15s, p1 should still have 10 seconds left!
    vi.advanceTimersByTime(20000);
    
    // Auto-pickup should NOT have triggered because the timer reset!
    expect(endRoundSpy).not.toHaveBeenCalled();

    // Fast forward 15 more seconds (total 35s since p1's turn started)
    vi.advanceTimersByTime(15000);

    // Now it should trigger for p1
    expect(room.broadcast).toHaveBeenCalledWith("turnExpired", { playerId: "p1" });
    expect(endRoundSpy).toHaveBeenCalledWith(room.state, "p1");
  });
});
