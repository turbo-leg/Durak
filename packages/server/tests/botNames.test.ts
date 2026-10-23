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

describe('Bot names', () => {
  it('names bots Orgil, Jagaa, Mugii, Dok and Tsomo, in that order', () => {
    const table = ['Ana'];
    for (let i = 0; i < 5; i++) table.push(nextBotName(table));
    expect(table.slice(1)).toEqual(['Orgil', 'Jagaa', 'Mugii', 'Dok', 'Tsomo']);
  });

  it('reuses a name once its bot has left and never gives two bots the same one', () => {
    expect(nextBotName(['Orgil', 'Mugii'])).toBe('Jagaa');
    expect(nextBotName([...BOT_NAMES])).toBe('Orgil 2');
    expect(nextBotName([...BOT_NAMES, 'Orgil 2'])).toBe('Jagaa 2');
  });

  it('gives each bot its own look: Jagaa and Tsomo are women, only Dok is dark', () => {
    const table: string[] = [];
    const looks = new Map<string, ReturnType<typeof avatarPreset>>();
    for (let i = 0; i < 5; i++) {
      const bot = nextBot(table);
      table.push(bot.name);
      const look = avatarPreset(bot.avatarPreset);
      expect(look.id).toBe(bot.avatarPreset);
      looks.set(bot.name, look);
    }
    // The women's hair styles carry long hair or a ponytail, and lashes.
    const women = [...looks].filter(([, look]) => look.hairStyle >= 5).map(([name]) => name);
    expect(women).toEqual(['Jagaa', 'Tsomo']);
    const dark = [...looks].filter(([, look]) => luminance(look.skin) < 0.3).map(([name]) => name);
    expect(dark).toEqual(['Dok']);
    expect(luminance(looks.get('Dok')!.skin)).toBeLessThan(0.12);
    // A repeated name keeps the look of the first.
    expect(nextBot([...BOT_NAMES]).avatarPreset).toBe(looks.get('Orgil')!.id);
  });
});
