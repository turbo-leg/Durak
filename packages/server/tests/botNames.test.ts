import { describe, expect, it } from 'vitest';
import { BOT_NAMES, nextBotName } from '../src/rooms/botNames';

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
});
