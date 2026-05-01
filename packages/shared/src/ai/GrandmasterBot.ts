import { GameState } from '../state/GameState';
import { DurakEngine } from '../engine/DurakEngine';
import { InferenceEngine } from './InferenceEngine';
import { GameTreeSearch, Move } from './MCTS';
import { Card } from '../state/Card';

export class GrandmasterBot {
  private memory: InferenceEngine = new InferenceEngine();
  public sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * High-level decision making: Deduction + Search
   */
  public think(state: GameState): Move {
    this.memory.observe(state);

    // 1. Get all legal moves
    const legalMoves = this.getLegalMoves(state);

    // 2. Identify "Checkmates" (Deduction-based)
    // If I attack with a card I KNOW they cannot beat, prioritze it immediately.
    const checkmate = this.findCheckmate(state, legalMoves);
    if (checkmate) {
      console.log(`🧠 [Grandmaster] Detected Checkmate! Applying strategic pressure.`);
      return checkmate;
    }

    // 3. Otherwise, use MCTS Search to look ahead
    return GameTreeSearch.findBestMove(state, this.sessionId, legalMoves);
  }

  /**
   * Scans for a move where the defender is deduced to have no valid counters.
   */
  private findCheckmate(state: GameState, moves: Move[]): Move | null {
    const defenderId = state.currentTurn; // simplistic for current turn state
    if (!defenderId) return null;

    for (const move of moves) {
      if (move.type === 'attack') {
        // Check if we know the defender is void in this suit AND trumps
        const knowsVoidInSuit =
          this.memory.getDeduction(defenderId, move.cards[0]) === 'impossible';
        const knowsVoidInTrumps = this.memory.voidSuits.get(defenderId)?.has(state.huzurSuit);

        if (knowsVoidInSuit && knowsVoidInTrumps) {
          return move;
        }
      }
    }
    return null;
  }

  private getLegalMoves(state: GameState): Move[] {
    const player = state.players.get(this.sessionId);
    if (!player) return [];

    // This would contain full Game Logic rules to find playable cards...
    // For now, return a placeholder
    return [{ type: 'pickup', cards: [] }];
  }
}
