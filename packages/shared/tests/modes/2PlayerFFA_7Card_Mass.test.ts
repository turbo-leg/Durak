import { describe, it, expect, beforeEach } from "vitest";
import { DurakEngine } from "../../src/engine/DurakEngine";
import { GameState } from "../../src/state/GameState";
import { Card, Suit, Rank } from "../../src/state/Card";

describe("2 Player FFA (7 Cards) - 5-Card Mass Attack", () => {
    let state: GameState;

    beforeEach(() => {
        state = new GameState();
        DurakEngine.initializeGame(state, ["p1", "p2"], 7);
    });

    it("should allow 5-card mass attack even if deck is not empty", () => {
        const atkCards = [
            new Card(Suit.Spades, Rank.Eight, false),
            new Card(Suit.Hearts, Rank.Eight, false),
            new Card(Suit.Clubs, Rank.Nine, false),
            new Card(Suit.Diamonds, Rank.Nine, false),
            new Card(Suit.Spades, Rank.King, false)
        ];

        // Ensure players have enough cards (7 initial > 5 needed)
        const p1 = state.players.get("p1")!;
        const p2 = state.players.get("p2")!;
        const allPlayers = [p1, p2];

        // Should return true for valid mass when deck > 0 AND targetHandSize = 7
        expect(DurakEngine.isValidMassAttack(atkCards, allPlayers, state.deck.length, 7)).toBe(true);
    });
});
