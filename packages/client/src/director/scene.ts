import { BOT_AVATARS, GESTURE_DURATION_MS, GESTURES, avatarPreset } from '@durak/shared';
import { ACTIONS, PLAY_RELEASE_MS, REACTIONS } from '../character/animations/registry.ts';
import type { TableCard } from '../game/tableSnapshot.ts';
import { ACTS } from './acts.ts';

/**
 * A scripted table scene for promo clips: who sits where, what they do and when, and where
 * the camera looks. Scenes are plain JSON (see `scenes/`), compiled here into a timeline the
 * stage can pose at any moment, forwards or backwards, with nothing carried between frames.
 */
export interface SceneFile {
  title?: string;
  /** Length in milliseconds. */
  duration: number;
  fps?: number;
  /** Seeds the characters' blink and glance rhythm, so every take matches. */
  seed?: number;
  background?: string;
  /** The table's felt colour. */
  felt?: string;
  /** Card back art: a name from `public/assets/cardbacks` (`classic`, `gold`, ...). */
  back?: string;
  /** The Huzur under the deck, in game notation (`Ah`, `7s`, `BJ`). */
  trump?: string;
  /** Cards left in the deck; 0 hides the deck and the Huzur. */
  deck?: number;
  /** The ElevenLabs voice that narrates the `say` beats (`npm run director:voice`). */
  voice?: { id: string; model?: string; language?: string; settings?: Record<string, unknown> };
  cast: CastFile[];
  camera?: ShotFile[];
  beats?: BeatFile[];
  /**
   * The scene written as lines and word-pinned cues instead of times; Node resolves it into
   * `beats` and `camera` from the voiced lines (scripts/lib/script.mjs) before it is played.
   */
  script?: Record<string, unknown>[];
}

export interface CastFile {
  name: string;
  /** An avatar or bot preset id; a bot's name alone picks its own look. */
  preset?: string;
  /** Cards in hand at the start. */
  cards?: number;
  /** Seat angle in degrees around the table: 0 nearest the default camera, 180 facing it. */
  seat?: number;
  /** The ElevenLabs voice this character speaks in, for `say` lines with their `who`. */
  voice?: SceneFile['voice'];
}

export type Vec3 = [number, number, number];

export interface ShotFile {
  at: number;
  /** `wide`, `top`, `table`, `face:<name>`, `over:<name>`, `hand:<name>` or `custom`. */
  shot: string;
  /** Milliseconds to glide from the previous shot; 0 or absent is a cut. */
  ease?: number;
  /** Narrows the lens: 1.5 is a 1.5x punch-in. */
  zoom?: number;
  /** Creeps toward the subject over the hold (0.1 closes a tenth of the distance). */
  push?: number;
  /** Hand-held shake amplitude, in world units (0.03 is subtle). */
  shake?: number;
  /** Raises (or with a negative value lowers) the camera, in world units (1 is about 30 cm). */
  lift?: number;
  /** Circles the camera around its subject, in degrees (positive is to the subject's left). */
  orbit?: number;
  eye?: Vec3;
  target?: Vec3;
}

export interface BeatFile {
  at: number;
  who?: string;
  /**
   * `play` (attack with `card`), `defend` (`card`, optionally `on` an attack card), `pickup`,
   * `draw` (`count`), `discard` (the table goes to the discard pile), `look` (`target`: a cast
   * name, `table`, `deck`, `camera` or `down`), `victory`, `say` (`text`, a caption cue), an
   * emote id (`one`, `two`, `three`, `four`, `nose`, `ear-left`, `ear-right`, `cry`, `cheer`,
   * `shrug`) or an act (`nod`, `no`, `laugh`, `facepalm`, `think`, `shock`, `sleep`,
   * `peek-left`, `peek-right`, `slam`, `point`).
   */
  do: string;
  card?: string;
  on?: string;
  count?: number;
  target?: string;
  text?: string;
  /** A spoken line's mouth shapes (`[ms, open]`), worked out by the voice script: with `who`,
   * that character's lips move. */
  mouth?: [number, number][];
}

export type Card = Pick<TableCard, 'rank' | 'suit' | 'isJoker'> & { key: string };

const RANKS: Record<string, number> = {
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
  // Game strengths, not the printed numerals: 3, 2 and Ace outrank the King.
  3: 14,
  2: 15,
  A: 16,
};
const SUITS: Record<string, string> = { c: 'Clubs', d: 'Diamonds', h: 'Hearts', s: 'Spades' };

/** A card in the server's notation: printed rank then a suit letter (`10h`, `Qs`), or `BJ`/`RJ`. */
export function parseCard(text: string): Card | undefined {
  const value = text.trim();
  if (value === 'BJ' || value === 'RJ')
    return { key: value, rank: value === 'RJ' ? 18 : 17, suit: 'None', isJoker: true };
  const match = /^(10|[2-9JQKA])([cdhs])$/i.exec(value);
  const rank = match && RANKS[match[1]!.toUpperCase()];
  if (!match || !rank) return undefined;
  const suit = SUITS[match[2]!.toLowerCase()]!;
  return {
    key: `${match[1]!.toUpperCase()}${match[2]!.toLowerCase()}`,
    rank,
    suit,
    isJoker: false,
  };
}

/** Where a visible card is: riding in a hand, on the table, on the deck or in the discard. */
export type Place =
  | { at: 'palm'; who: string }
  | { at: 'hand'; who: string }
  | { at: 'attack'; index: number }
  | { at: 'defense'; index: number }
  | { at: 'deck' }
  | { at: 'discard'; index: number };

/** A card holds `place` from `arrive` until `depart`, then flies to the next stop. */
export interface Stop {
  place: Place;
  arrive: number;
  depart: number;
}
export interface CardTrack {
  id: string;
  /** Face-down when absent (a card drawn from the deck). */
  card?: Card;
  stops: Stop[];
}

export interface ActionCue {
  id: 'play' | 'pickup' | 'draw' | 'victory';
  at: number;
  /** For a play: the table place the card is headed for. */
  place?: Place;
  /** Cards in hand as the action starts, which decides the hand that acts. */
  count: number;
}

export interface Seat {
  name: string;
  preset: string;
  cards: number;
  /** Radians around the table, 0 nearest the default camera. */
  angle: number;
}

export interface Timeline {
  title: string;
  duration: number;
  fps: number;
  seed: number;
  background: string;
  felt: string;
  back: string;
  trump?: Card;
  deck: number;
  seats: Seat[];
  cards: CardTrack[];
  /** Hand count changes per seat, in time order. */
  counts: Record<string, { t: number; delta: number }[]>;
  deckDraws: number[];
  actions: Record<string, ActionCue[]>;
  gestures: Record<string, { id: string; at: number }[]>;
  /** Scripted performances (`acts.ts`) per seat. */
  acts: Record<string, { id: string; at: number }[]>;
  /** Lines a seat speaks, with their mouth shapes. */
  talks: Record<string, { at: number; mouth: [number, number][] }[]>;
  looks: Record<string, { at: number; target: string }[]>;
  shots: ShotFile[];
  captions: { at: number; who?: string; text: string }[];
}

/** How long a released card glides to the table, and a picked-up one to the hand. */
export const FLIGHT_MS = 260;
const PICKUP_TAKE_MS = ACTIONS.pickup.R.peak ?? 600;
const DRAW_TAKE_MS = ACTIONS.draw.R.peak ?? 450;
const DRAW_SPACING_MS = 650;
const DISCARD_MS = 420;

const EMOTE_IDS = new Set<string>(GESTURES.map((g) => g.id));
const SHOTS = ['wide', 'top', 'table', 'custom'];
const SUBJECT_SHOTS = ['face', 'over', 'hand'];
const LOOK_TARGETS = ['table', 'deck', 'camera', 'down'];

export const actionDuration = (id: ActionCue['id']) =>
  id === 'victory' ? REACTIONS.victory.duration : ACTIONS[id].R.duration;
export const gestureDuration = GESTURE_DURATION_MS;

/** Validate a scene and compile it; every problem is reported at once, by beat. */
export function compileScene(scene: SceneFile): Timeline {
  const problems: string[] = [];
  if (!Array.isArray(scene.cast) || scene.cast.length < 2 || scene.cast.length > 6)
    problems.push('cast: 2 to 6 players');
  if (!(scene.duration > 0)) problems.push('duration: a positive number of milliseconds');
  const cast = Array.isArray(scene.cast) ? scene.cast : [];
  const names = new Map<string, string>();
  const seats: Seat[] = cast.map((member, i) => {
    const name = String(member.name ?? '').trim();
    if (!name) problems.push(`cast[${i}]: a name`);
    if (names.has(name.toLowerCase())) problems.push(`cast[${i}]: "${name}" is seated twice`);
    names.set(name.toLowerCase(), name);
    const bot = BOT_AVATARS.find((look) => look.name.toLowerCase() === name.toLowerCase());
    const preset = member.preset ?? bot?.id ?? 'casual';
    if (avatarPreset(preset).id !== preset) problems.push(`cast[${i}]: unknown preset "${preset}"`);
    const angle =
      member.seat === undefined
        ? Math.PI + (i * Math.PI * 2) / cast.length
        : (member.seat * Math.PI) / 180;
    return { name, preset, cards: member.cards ?? 6, angle };
  });
  const who = (beat: BeatFile, where: string) => {
    const name = beat.who && names.get(beat.who.trim().toLowerCase());
    if (!name) problems.push(`${where}: "who" must name someone in the cast`);
    return name || '';
  };
  const card = (text: string | undefined, where: string) => {
    const parsed = text ? parseCard(text) : undefined;
    if (!parsed) problems.push(`${where}: "${text ?? ''}" is not a card (7h, 10s, Qd, As, 3c, BJ)`);
    return parsed;
  };

  const per = <T>() => Object.fromEntries(seats.map((s) => [s.name, [] as T[]]));
  const counts = per<{ t: number; delta: number }>();
  const actions = per<ActionCue>();
  const gestures = per<{ id: string; at: number }>();
  const acts = per<{ id: string; at: number }>();
  const talks = per<{ at: number; mouth: [number, number][] }>();
  const looks = per<{ at: number; target: string }>();
  const cards: CardTrack[] = [];
  const captions: Timeline['captions'] = [];
  const deckDraws: number[] = [];
  const handCount = (name: string, t: number) =>
    (seats.find((s) => s.name === name)?.cards ?? 0) +
    (counts[name] ?? []).filter((c) => c.t <= t).reduce((sum, c) => sum + c.delta, 0);
  // The table as the script runs: attack cards and the cards covering them.
  let attacks: CardTrack[] = [];
  let defenses: (CardTrack | undefined)[] = [];
  let discarded = 0;
  let drawn = 0;
  const deck = scene.deck ?? 12;

  const beats = (scene.beats ?? [])
    .map((beat, i) => ({ beat, i }))
    .sort((a, b) => a.beat.at - b.beat.at || a.i - b.i);
  for (const { beat, i } of beats) {
    const where = `beats[${i}] (${beat.do} at ${beat.at})`;
    const at = Number(beat.at);
    if (!Number.isFinite(at) || at < 0) {
      problems.push(`${where}: "at" must be milliseconds from the start`);
      continue;
    }
    switch (beat.do) {
      case 'play':
      case 'defend': {
        const name = who(beat, where);
        const parsed = card(beat.card, where);
        if (!name || !parsed) break;
        let place: Place;
        if (beat.do === 'play') {
          if (attacks.length >= 6) problems.push(`${where}: the table already holds six attacks`);
          place = { at: 'attack', index: attacks.length };
        } else {
          const target = beat.on
            ? attacks.findIndex((track) => track.card?.key === parseCard(beat.on!)?.key)
            : attacks.findIndex((_, index) => !defenses[index]);
          if (target < 0 || defenses[target]) {
            problems.push(`${where}: nothing uncovered to defend${beat.on ? ` (${beat.on})` : ''}`);
            break;
          }
          place = { at: 'defense', index: target };
        }
        const release = at + PLAY_RELEASE_MS;
        const track: CardTrack = {
          id: `${parsed.key}@${at}`,
          card: parsed,
          stops: [
            { place: { at: 'palm', who: name }, arrive: at, depart: release },
            { place, arrive: release + FLIGHT_MS, depart: Infinity },
          ],
        };
        cards.push(track);
        actions[name]!.push({ id: 'play', at, place, count: handCount(name, at) });
        counts[name]!.push({ t: at, delta: -1 });
        if (place.at === 'attack') attacks.push(track);
        else defenses[place.index] = track;
        break;
      }
      case 'pickup': {
        const name = who(beat, where);
        if (!name) break;
        const table = [...attacks, ...defenses.filter((d): d is CardTrack => Boolean(d))];
        if (!table.length) problems.push(`${where}: the table is empty`);
        actions[name]!.push({ id: 'pickup', at, count: handCount(name, at) });
        table.forEach((track, n) =>
          leave(track, { at: 'hand', who: name }, at + PICKUP_TAKE_MS + n * 40),
        );
        for (const track of table) counts[name]!.push({ t: track.stops.at(-1)!.arrive, delta: 1 });
        attacks = [];
        defenses = [];
        break;
      }
      case 'discard': {
        const table = [...attacks, ...defenses.filter((d): d is CardTrack => Boolean(d))];
        table.forEach((track, n) =>
          leave(track, { at: 'discard', index: discarded++ }, at + n * 60, DISCARD_MS),
        );
        attacks = [];
        defenses = [];
        break;
      }
      case 'draw': {
        const name = who(beat, where);
        if (!name) break;
        const count = beat.count ?? 1;
        for (let n = 0; n < count; n++) {
          const start = at + n * DRAW_SPACING_MS;
          if (drawn >= deck) {
            problems.push(`${where}: the deck has run out`);
            break;
          }
          drawn++;
          const take = start + DRAW_TAKE_MS;
          actions[name]!.push({ id: 'draw', at: start, count: handCount(name, start) });
          cards.push({
            id: `draw:${name}@${start}`,
            stops: [
              { place: { at: 'deck' }, arrive: start, depart: take },
              { place: { at: 'hand', who: name }, arrive: take + FLIGHT_MS, depart: Infinity },
            ],
          });
          deckDraws.push(take);
          counts[name]!.push({ t: take + FLIGHT_MS, delta: 1 });
        }
        break;
      }
      case 'victory': {
        const name = who(beat, where);
        if (name) actions[name]!.push({ id: 'victory', at, count: handCount(name, at) });
        break;
      }
      case 'look': {
        const name = who(beat, where);
        const target = beat.target?.trim() ?? '';
        const person = names.get(target.toLowerCase());
        if (!person && !LOOK_TARGETS.includes(target))
          problems.push(`${where}: look at a cast name, ${LOOK_TARGETS.join(', ')}`);
        if (name) looks[name]!.push({ at, target: person ?? target });
        break;
      }
      case 'say': {
        if (!beat.text) {
          problems.push(`${where}: a "text" line`);
          break;
        }
        const speaker = beat.who ? who(beat, where) : undefined;
        captions.push({ at, text: beat.text, ...(speaker && { who: speaker }) });
        if (speaker && beat.mouth?.length) talks[speaker]!.push({ at, mouth: beat.mouth });
        break;
      }
      default: {
        const act = beat.do in ACTS;
        if (!act && !EMOTE_IDS.has(beat.do)) {
          problems.push(`${where}: unknown action "${beat.do}"`);
          break;
        }
        const name = who(beat, where);
        if (name) (act ? acts : gestures)[name]!.push({ id: beat.do, at });
      }
    }
  }

  const shots = (scene.camera ?? [{ at: 0, shot: 'wide' }])
    .map((shot) => ({ ...shot }))
    .sort((a, b) => a.at - b.at);
  shots.forEach((shot, i) => {
    const [kind, subject] = shot.shot.split(':') as [string, string | undefined];
    const where = `camera[${i}] (${shot.shot})`;
    if (SUBJECT_SHOTS.includes(kind)) {
      if (!subject || !names.has(subject.toLowerCase()))
        problems.push(`${where}: name someone seated`);
      else shot.shot = `${kind}:${names.get(subject.toLowerCase())}`;
    } else if (!SHOTS.includes(kind))
      problems.push(
        `${where}: use ${[...SHOTS, ...SUBJECT_SHOTS.map((s) => `${s}:<name>`)].join(', ')}`,
      );
    else if (kind === 'custom' && (!shot.eye || !shot.target))
      problems.push(`${where}: a custom shot needs "eye" and "target"`);
  });
  if (!shots.length || shots[0]!.at > 0) shots.unshift({ at: 0, shot: 'wide' });

  const trump = scene.trump ? card(scene.trump, 'trump') : undefined;
  if (problems.length) throw new SceneError(problems);
  return {
    title: scene.title ?? 'Untitled scene',
    duration: scene.duration,
    fps: scene.fps ?? 30,
    seed: scene.seed ?? 7,
    background: scene.background ?? '#182b3c',
    felt: scene.felt ?? '#2f6382',
    back: scene.back ?? 'classic',
    trump,
    deck,
    seats,
    cards,
    counts,
    deckDraws,
    actions,
    gestures,
    acts,
    talks,
    looks,
    shots,
    captions,
  };
}

/** Send a card from where it lies to `place`, leaving at `depart`. */
function leave(track: CardTrack, place: Place, depart: number, flight = FLIGHT_MS) {
  track.stops.at(-1)!.depart = depart;
  track.stops.push({ place, arrive: depart + flight, depart: Infinity });
}

export class SceneError extends Error {
  constructor(readonly problems: string[]) {
    super(`Scene has ${problems.length} problem(s):\n${problems.join('\n')}`);
  }
}

/** Cards in a seat's hand at `t`. */
export function cardsAt(timeline: Timeline, name: string, t: number) {
  const seat = timeline.seats.find((s) => s.name === name);
  return Math.max(
    0,
    (seat?.cards ?? 0) +
      (timeline.counts[name] ?? []).filter((c) => c.t <= t).reduce((sum, c) => sum + c.delta, 0),
  );
}

/** Where a card is at `t`: resting at a stop, or partway (`progress` 0 to 1) between two. */
export function cardAt(track: CardTrack, t: number) {
  const first = track.stops[0]!;
  if (t < first.arrive) return undefined;
  for (let i = 0; i < track.stops.length; i++) {
    const stop = track.stops[i]!;
    if (t <= stop.depart) return { from: stop.place, to: stop.place, progress: 1 };
    const next = track.stops[i + 1];
    if (next && t < next.arrive)
      return {
        from: stop.place,
        to: next.place,
        progress: (t - stop.depart) / (next.arrive - stop.depart),
      };
  }
  return undefined;
}

/** The most recent cue at or before `t`. */
export function latest<T extends { at: number }>(cues: readonly T[], t: number) {
  let found: T | undefined;
  for (const cue of cues) if (cue.at <= t) found = cue;
  return found;
}

/** The camera shot in force at `t`, and the one it is easing from. */
export function shotAt(timeline: Timeline, t: number) {
  const index = timeline.shots.findLastIndex((shot) => shot.at <= t);
  const shot = timeline.shots[Math.max(0, index)]!;
  const previous = index > 0 ? timeline.shots[index - 1] : undefined;
  const next = timeline.shots[index + 1];
  const blend = shot.ease && previous ? Math.min(1, (t - shot.at) / shot.ease) : 1;
  // Push-in runs across the hold, until the next shot.
  const hold = Math.max(1, (next?.at ?? timeline.duration) - shot.at);
  return { shot, previous, blend, held: Math.min(1, (t - shot.at) / hold) };
}
