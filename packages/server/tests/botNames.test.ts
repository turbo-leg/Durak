import { describe, expect, it } from 'vitest';
import { avatarPreset } from '@durak/shared';
import { BOT_NAMES, nextBot, nextBotName } from '../src/rooms/botNames';

/** Relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const first = () => 0;

describe('Bot names', () => {
  it('names bots Orgil, Jagaa, Mugii, Dok, Tsomo and Buyna, never two alike', () => {
    expect([...BOT_NAMES].sort()).toEqual(['Buyna', 'Dok', 'Jagaa', 'Mugii', 'Orgil', 'Tsomo']);
    for (let game = 0; game < 20; game++) {
      const table = ['Ana'];
      for (let i = 0; i < 6; i++) table.push(nextBotName(table));
      expect(table.slice(1).sort()).toEqual([...BOT_NAMES].sort());
    }
  });

  it('picks among the free names at random, so every bot turns up', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(nextBotName(['Ana']));
    expect([...seen].sort()).toEqual([...BOT_NAMES].sort());
  });

  it('reuses a name once its bot has left; past the list, names repeat with a number', () => {
    expect(nextBotName(BOT_NAMES.filter((name) => name !== 'Dok'))).toBe('Dok');
    expect(nextBotName([...BOT_NAMES], first)).toBe(`${BOT_NAMES[0]} 2`);
  });

  it('gives each bot its own look: the women, only Dok dark, Buyna a lot smaller', () => {
    const looks = new Map<string, ReturnType<typeof avatarPreset>>();
    const table: string[] = [];
    for (let i = 0; i < 6; i++) {
      const bot = nextBot(table, first);
      table.push(bot.name);
      const look = avatarPreset(bot.avatarPreset);
      expect(look.id).toBe(bot.avatarPreset);
      looks.set(bot.name, look);
    }
    // The women's hair styles carry long hair, a ponytail or pigtails, and lashes.
    const women = [...looks].filter(([, look]) => look.hairStyle >= 5).map(([name]) => name);
    expect(women.sort()).toEqual(['Buyna', 'Jagaa', 'Tsomo']);
    const dark = [...looks].filter(([, look]) => luminance(look.skin) < 0.3).map(([name]) => name);
    expect(dark).toEqual(['Dok']);
    expect(luminance(looks.get('Dok')!.skin)).toBeLessThan(0.12);
    const small = [...looks].filter(([, look]) => (look.size ?? 1) < 1).map(([name]) => name);
    expect(small).toEqual(['Buyna']);
    expect(looks.get('Buyna')!.size).toBeLessThanOrEqual(0.75);
    // A repeated name keeps the look of the first.
    expect(nextBot([...BOT_NAMES], first).avatarPreset).toBe(looks.get(BOT_NAMES[0]!)!.id);
  });
});
