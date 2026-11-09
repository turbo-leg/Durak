// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AVATAR_PRESETS, GESTURES } from '@durak/shared';
import { MN } from '../i18n/mn';
import { getLang, resetLangForTests, setLang, t, tServer } from '../i18n';
import { HAND_ORDER_LABEL } from '../game/handOrder';
import { GUIDED_STEPS } from '../game/guidedSteps';
import { cardLabel } from '../game/tableSnapshot';

const SRC = join(__dirname, '..');
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ['test', 'i18n'].includes(name) ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every literal t('…') in the UI, so a new English string can't ship without Mongolian. */
const literalKeys = [
  ...new Set(
    sources(SRC).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) =>
        m[1]!.replace(/\\'/g, "'"),
      ),
    ),
  ),
];

/** Text that reaches t() through data rather than a literal. */
const dataKeys = [
  ...['Spades', 'Hearts', 'Diamonds', 'Clubs', 'Jack', 'Queen', 'King', 'Ace'],
  ...['1v1', '2v2', '3v3', 'Free-for-all', 'classic', 'teams', 'horse'],
  ...AVATAR_PRESETS.filter((p) => !p.id.startsWith('bot-')).map((p) => p.name),
  ...GESTURES.map((g) => g.label),
  ...Object.values(HAND_ORDER_LABEL),
  ...GUIDED_STEPS.flatMap((s) => [s.title, s.lesson, s.done]),
];

afterEach(() => resetLangForTests('en'));

describe('Mongolian UI text', () => {
  it('has a translation for every UI string', () => {
    expect(literalKeys.length).toBeGreaterThan(250);
    expect([...literalKeys, ...dataKeys].filter((key) => !(key in MN))).toEqual([]);
  });

  it('keeps every placeholder of the English text', () => {
    const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
    const broken = Object.entries(MN).filter(([en, mn]) => holes(en) !== holes(mn));
    expect(broken).toEqual([]);
  });

  it('uses Cyrillic, not Latin look-alikes, inside Mongolian words', () => {
    const mixed = Object.values(MN).filter((mn) => /[а-яөү][a-z]|[a-z][а-яөү]/i.test(mn));
    expect(mixed).toEqual([]);
  });

  it('switches language and fills placeholders', () => {
    expect(getLang()).toBe('en');
    expect(t('{name} wins.', { name: 'Orgil' })).toBe('Orgil wins.');
    setLang('mn');
    expect(t('{name} wins.', { name: 'Orgil' })).toBe('Orgil хожлоо.');
    expect(t('Pick up')).toBe('Авах');
    expect(cardLabel({ suit: 'Spades', rank: 16, isJoker: false })).toBe('гил тамга');
    expect(t('Not translated yet')).toBe('Not translated yet');
  });

  it('translates server messages, including ones with a player name', () => {
    setLang('mn');
    expect(tServer('Nothing to pick up.')).toBe('Авах хөзөр алга.');
    expect(tServer('Jagaa reconnected.')).toBe('Jagaa буцаж ирлээ.');
    expect(tServer('Some new server text')).toBe('Some new server text');
    setLang('en');
    expect(tServer('Nothing to pick up.')).toBe('Nothing to pick up.');
  });
});
