import OpenAI from 'openai';
import { GameState } from '@durak/shared';
import { serializeGameState, buildLegalMoves, BotMove, SYSTEM_PROMPT } from './GameStateSerializer';

export type BotDifficulty = 'easy' | 'hard';

const MODELS: Record<BotDifficulty, string> = {
  easy: 'gpt-4o-mini',
  hard: 'gpt-4o',
};

const TEMPERATURES: Record<BotDifficulty, number> = {
  easy: 0.9,
  hard: 0.2,
};

export class OpenAIBot {
  private client: OpenAI | null = null;
  private pendingTurns = new Set<string>(); // botId:turnToken — deduplicates concurrent calls

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      console.warn('[OpenAIBot] OPENAI_API_KEY not set — bot will use random fallback moves.');
    }
  }

  async think(
    state: GameState,
    botId: string,
    difficulty: BotDifficulty = 'easy',
  ): Promise<BotMove | null> {
    const turnToken = `${botId}:${state.turnStartTime}`;
    if (this.pendingTurns.has(turnToken)) return null; // already deciding
    this.pendingTurns.add(turnToken);

    try {
      const moves = buildLegalMoves(state, botId);
      if (moves.length === 0) return null;
      if (moves.length === 1) return moves[0]!;

      const move = this.client
        ? await this.askLLM(state, botId, moves, difficulty)
        : this.randomMove(moves);

      return move;
    } catch (err) {
      console.error('[OpenAIBot] Error during think():', err);
      return this.randomFallback(state, botId);
    } finally {
      this.pendingTurns.delete(turnToken);
    }
  }

  private async askLLM(
    state: GameState,
    botId: string,
    moves: BotMove[],
    difficulty: BotDifficulty,
  ): Promise<BotMove> {
    const prompt = serializeGameState(state, botId);

    let raw: string | null = null;
    try {
      const response = await this.client!.chat.completions.create({
        model: MODELS[difficulty],
        temperature: TEMPERATURES[difficulty],
        max_tokens: 20,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });
      raw = response.choices[0]?.message?.content ?? null;
    } catch (err) {
      console.error('[OpenAIBot] OpenAI API call failed:', err);
      return this.randomMove(moves);
    }

    if (!raw) return this.randomMove(moves);

    try {
      const parsed = JSON.parse(raw.trim());
      const choice = Number(parsed.choice);
      if (Number.isInteger(choice) && choice >= 1 && choice <= moves.length) {
        return moves[choice - 1]!;
      }
    } catch {
      console.warn('[OpenAIBot] Could not parse LLM response:', raw);
    }

    return this.randomMove(moves);
  }

  private randomMove(moves: BotMove[]): BotMove {
    return moves[Math.floor(Math.random() * moves.length)]!;
  }

  private randomFallback(state: GameState, botId: string): BotMove | null {
    const moves = buildLegalMoves(state, botId);
    return moves.length > 0 ? this.randomMove(moves) : null;
  }
}

// Single shared instance for the process
export const openAIBot = new OpenAIBot();
