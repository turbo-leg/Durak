import { describe, expect, it } from 'vitest';
import { GameState, Player } from '@durak/shared';
import { Card, Rank, Suit } from '@durak/shared/src/state/Card';
import { BotEngine } from '../src/ai/BotEngine';
import { ATTACK_MODEL_FEATURES } from '../src/ai/BotAttackModel';
import { DUEL_CHAMPION_POLICY } from '../src/ai/BotDuelChampion';
import { BASELINE_POLICY } from '../src/ai/BotPolicy';
import { playBotMatch } from './botMatch';

function duel(opponentCards: Card[], deckCards: Card[] = []): GameState {
  const state = new GameState();
  state.phase = 'playing';
  state.mode = 'classic';
  state.currentTurn = 'bot';
  state.turnStartTime = 1;
  state.huzurSuit = Suit.Spades;
  state.huzurCard = new Card(Suit.Spades, Rank.Seven);
  state.seatOrder.push('bot', 'opponent');
  const bot = new Player('bot');
  bot.hand.push(new Card(Suit.Hearts, Rank.Seven), new Card(Suit.Spades, Rank.Ace));
  const opponent = new Player('opponent');
  opponent.hand.push(...opponentCards);
  state.players.set('bot', bot);
  state.players.set('opponent', opponent);
  state.deck.push(...deckCards);
  return state;
}

describe('duel finish threat', () => {
  it('chooses a legal full-hand mass attack for an immediate win', async () => {
    const state = duel([
      new Card(Suit.Clubs, Rank.Eight),
      new Card(Suit.Clubs, Rank.Nine),
      new Card(Suit.Clubs, Rank.Ten),
      new Card(Suit.Diamonds, Rank.Jack),
      new Card(Suit.Diamonds, Rank.Queen),
    ]);
    const bot = state.players.get('bot')!;
    bot.hand.splice(0, bot.hand.length);
    bot.hand.push(
      new Card(Suit.Hearts, Rank.Seven),
      new Card(Suit.Clubs, Rank.Seven),
      new Card(Suit.Spades, Rank.Ace),
    );
    const move = await new BotEngine({
      ...BASELINE_POLICY,
      exploreMass: true,
      massBonus: 0,
      finishWinBonus: 1000,
    }).think(state, 'bot', 'hard');
    expect(move?.action).toBe('attack');
    expect(move?.cards).toHaveLength(3);
  });

  it('uses a difficult attack when a one-card opponent can win after defending', async () => {
    const state = duel([new Card(Suit.Hearts, Rank.Eight)]);
    const current = await new BotEngine(DUEL_CHAMPION_POLICY).think(state, 'bot', 'hard');
    const prior = await new BotEngine({ ...DUEL_CHAMPION_POLICY, blockFinishWeight: 0 }).think(
      state,
      'bot',
      'hard',
    );
    expect(current).toMatchObject({
      action: 'attack',
      cards: [{ suit: Suit.Spades, rank: Rank.Ace }],
    });
    expect(prior).toMatchObject({
      action: 'attack',
      cards: [{ suit: Suit.Hearts, rank: Rank.Seven }],
    });
  });

  it('conserves the trump while the opponent is not a finish threat', async () => {
    const state = duel(
      [new Card(Suit.Hearts, Rank.Eight), new Card(Suit.Clubs, Rank.Nine)],
      [new Card(Suit.Diamonds, Rank.Ten)],
    );
    const move = await new BotEngine(DUEL_CHAMPION_POLICY).think(state, 'bot', 'hard');
    expect(move).toMatchObject({
      action: 'attack',
      cards: [{ suit: Suit.Hearts, rank: Rank.Seven }],
    });
  });

  it('lets an outcome-trained model change a legal attack choice', async () => {
    const state = duel(
      [new Card(Suit.Hearts, Rank.Eight), new Card(Suit.Clubs, Rank.Nine)],
      [new Card(Suit.Diamonds, Rank.Ten)],
    );
    const weights = ATTACK_MODEL_FEATURES.map(() => 0);
    weights[2] = 1000;
    const move = await new BotEngine(DUEL_CHAMPION_POLICY, Math.random, {
      id: 'test-trump-preference',
      weights,
    }).think(state, 'bot', 'hard');
    expect(move).toMatchObject({
      action: 'attack',
      cards: [{ suit: Suit.Spades, rank: Rank.Ace }],
    });
  });
});

describe.skipIf(process.env.BOT_THREAT_RUN !== '1')('duel finish threat benchmark', () => {
  it('compares the new decision with the previous policy on fresh, swapped seats', async () => {
    const prior = { ...DUEL_CHAMPION_POLICY, id: 'prior-duel', blockFinishWeight: 0 };
    let wins = 0;
    let stalls = 0;
    for (let seed = 0; seed < 500; seed++) {
      for (let seat = 0; seat < 2; seat++) {
        const game = await playBotMatch(11000000 + seed, seat, DUEL_CHAMPION_POLICY, {
          players: 2,
          incumbent: prior,
        });
        wins += Number(game.winner === seat);
        stalls += Number(game.stalled || game.invalid);
      }
    }
    process.stdout.write(`Finish-threat policy: ${wins}/1000 wins, ${stalls} stalls\n`);
    expect(stalls).toBe(0);
  }, 120000);
});
