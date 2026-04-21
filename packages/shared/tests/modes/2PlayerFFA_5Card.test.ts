import { describe, it, expect, beforeEach } from "vitest";
import { DurakEngine } from "../../src/engine/DurakEngine";
import { GameState } from "../../src/state/GameState";

describe("2 Player FFA (5 Cards)", () => {
    let state: GameState;

    beforeEach(() => {
        state = new GameState();
        DurakEngine.initializeGame(state, ["p1", "p2"], 5); // Assuming handSize config can be passed or is default
    });

    it("should initialize with 5 cards per player", () => {
        const p1 = state.players.get("p1")!;
        const p2 = state.players.get("p2")!;
        expect(p1.hand.length).toBe(5);
        expect(p2.hand.length).toBe(5);
        expect(state.deck.length).toBe(42 - 10);
    });
});
