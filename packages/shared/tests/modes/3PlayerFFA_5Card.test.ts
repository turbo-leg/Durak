import { describe, it, expect, beforeEach } from "vitest";
import { DurakEngine } from "../../src/engine/DurakEngine";
import { GameState } from "../../src/state/GameState";

describe("3 Player FFA (5 Cards)", () => {
    let state: GameState;

    beforeEach(() => {
        state = new GameState();
        DurakEngine.initializeGame(state, ["p1", "p2", "p3"], 5);
    });

    it("should initialize with 5 cards per player", () => {
        expect(state.players.get("p1")!.hand.length).toBe(5);
        expect(state.players.get("p2")!.hand.length).toBe(5);
        expect(state.players.get("p3")!.hand.length).toBe(5);
        expect(state.deck.length).toBe(42 - 15);
    });
});
