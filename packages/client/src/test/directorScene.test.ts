import { describe, expect, it } from 'vitest';
import {
  cardAt,
  cardsAt,
  compileScene,
  FLIGHT_MS,
  parseCard,
  SceneError,
  shotAt,
  type SceneFile,
} from '../director/scene';
import { PLAY_RELEASE_MS } from '../character/animations/registry';

const scene = (beats: SceneFile['beats'], extra: Partial<SceneFile> = {}): SceneFile => ({
  duration: 8000,
  cast: [
    { name: 'Jagaa', cards: 3 },
    { name: 'Orgil', cards: 6 },
  ],
  beats,
  ...extra,
});

const problems = (file: SceneFile) => {
  try {
    compileScene(file);
    return [];
  } catch (error) {
    if (error instanceof SceneError) return error.problems;
    throw error;
  }
};

describe('director scenes', () => {
  it('reads cards in the server notation, with game strengths', () => {
    expect(parseCard('7h')).toMatchObject({ rank: 7, suit: 'Hearts', isJoker: false });
    expect(parseCard('10s')).toMatchObject({ rank: 10, suit: 'Spades' });
    expect(parseCard('qd')).toMatchObject({ key: 'Qd', rank: 12, suit: 'Diamonds' });
    expect(parseCard('3c')?.rank).toBe(14);
    expect(parseCard('2c')?.rank).toBe(15);
    expect(parseCard('As')?.rank).toBe(16);
    expect(parseCard('RJ')).toMatchObject({ rank: 18, isJoker: true });
    expect(parseCard('6h')).toBeUndefined();
    expect(parseCard('Xs')).toBeUndefined();
  });

  it('gives bots their own look and seats the first player facing the camera', () => {
    const timeline = compileScene(scene([]));
    expect(timeline.seats.map((s) => s.preset)).toEqual(['bot-jagaa', 'bot-orgil']);
    expect(timeline.seats[0]!.angle).toBeCloseTo(Math.PI);
    const custom = compileScene(
      scene([], { cast: [{ name: 'Me', preset: 'sage', seat: 0 }, { name: 'Dok' }] }),
    );
    expect(custom.seats[0]).toMatchObject({ preset: 'sage', angle: 0, cards: 6 });
  });

  it('moves cards from hand to table and back through a pickup', () => {
    const timeline = compileScene(
      scene([
        { at: 100, who: 'Orgil', do: 'play', card: '7s' },
        { at: 1500, who: 'Jagaa', do: 'pickup' },
      ]),
    );
    expect(cardsAt(timeline, 'Orgil', 99)).toBe(6);
    expect(cardsAt(timeline, 'Orgil', 100)).toBe(5);
    const [card] = timeline.cards;
    expect(cardAt(card!, 50)).toBeUndefined();
    expect(cardAt(card!, 200)?.to).toEqual({ at: 'palm', who: 'Orgil' });
    const landing = 100 + PLAY_RELEASE_MS + FLIGHT_MS;
    expect(cardAt(card!, landing)).toMatchObject({ to: { at: 'attack', index: 0 }, progress: 1 });
    expect(cardsAt(timeline, 'Jagaa', 1500)).toBe(3);
    expect(cardsAt(timeline, 'Jagaa', 4000)).toBe(4);
    expect(cardAt(card!, 4000)?.to).toEqual({ at: 'hand', who: 'Jagaa' });
  });

  it('covers the first open attack, or the one named', () => {
    const timeline = compileScene(
      scene([
        { at: 0, who: 'Orgil', do: 'play', card: '7s' },
        { at: 100, who: 'Orgil', do: 'play', card: '7d' },
        { at: 900, who: 'Jagaa', do: 'defend', card: '9d', on: '7d' },
        { at: 1800, who: 'Jagaa', do: 'defend', card: 'Ks' },
      ]),
    );
    const placed = timeline.cards.map((track) => track.stops[1]!.place);
    expect(placed).toEqual([
      { at: 'attack', index: 0 },
      { at: 'attack', index: 1 },
      { at: 'defense', index: 1 },
      { at: 'defense', index: 0 },
    ]);
  });

  it('draws from the deck one card at a time', () => {
    const timeline = compileScene(
      scene([{ at: 0, who: 'Jagaa', do: 'draw', count: 2 }], { deck: 5 }),
    );
    expect(timeline.deckDraws).toHaveLength(2);
    expect(timeline.actions.Jagaa!.map((cue) => cue.at)).toEqual([0, 650]);
    expect(cardsAt(timeline, 'Jagaa', 5000)).toBe(5);
  });

  it('eases between shots and reports where it is', () => {
    const timeline = compileScene(
      scene([], {
        camera: [
          { at: 0, shot: 'wide' },
          { at: 1000, shot: 'face:jagaa', ease: 500 },
        ],
      }),
    );
    expect(timeline.shots[1]!.shot).toBe('face:Jagaa');
    expect(shotAt(timeline, 1250)).toMatchObject({ blend: 0.5 });
    expect(shotAt(timeline, 2000).blend).toBe(1);
  });

  it('lists every problem in a scene at once', () => {
    expect(
      problems(
        scene(
          [
            { at: 0, who: 'Nobody', do: 'play', card: '7s' },
            { at: 10, who: 'Jagaa', do: 'play', card: '6s' },
            { at: 20, who: 'Jagaa', do: 'dance' },
            { at: 30, who: 'Orgil', do: 'defend', card: '9s' },
            { at: 40, who: 'Orgil', do: 'look', target: 'moon' },
          ],
          { camera: [{ at: 0, shot: 'face:Nobody' }] },
        ),
      ),
    ).toEqual([
      'beats[0] (play at 0): "who" must name someone in the cast',
      'beats[1] (play at 10): "6s" is not a card (7h, 10s, Qd, As, 3c, BJ)',
      'beats[2] (dance at 20): unknown action "dance"',
      'beats[3] (defend at 30): nothing uncovered to defend',
      'beats[4] (look at 40): look at a cast name, table, deck, camera, down',
      'camera[0] (face:Nobody): name someone seated',
    ]);
    expect(problems(scene([], { cast: [{ name: 'Solo' }] }))).toContain('cast: 2 to 6 players');
  });

  it('compiles the bundled scenes', async () => {
    const files = import.meta.glob<SceneFile>('../director/scenes/*.json', {
      eager: true,
      import: 'default',
    });
    expect(Object.keys(files).length).toBeGreaterThan(0);
    for (const file of Object.values(files)) expect(() => compileScene(file)).not.toThrow();
  });
});
