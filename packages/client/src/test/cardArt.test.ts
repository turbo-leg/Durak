import { describe, expect, it } from 'vitest';
import { Card, DurakEngine } from '@durak/shared';
import { cardFaceUrl } from '../game/cardArt';

describe('classic artwork for the custom Durak deck', () => {
  it('ships a unique local face for every card the engine can deal', () => {
    const urls = DurakEngine.createDeck().map(cardFaceUrl);
    expect(urls).toHaveLength(42);
    expect(new Set(urls).size).toBe(42);
    for (const url of urls) {
      expect(url).toBeDefined();
    }
  });
  it('prints the high 3, 2 and Ace rather than their numeric strength', () => {
    expect(cardFaceUrl(new Card('Hearts', 14))).toMatch(/3-of-hearts.webp$/);
    expect(cardFaceUrl(new Card('Hearts', 15))).toMatch(/2-of-hearts.webp$/);
    expect(cardFaceUrl(new Card('Hearts', 16))).toMatch(/ace-of-hearts.webp$/);
    expect(cardFaceUrl(new Card('None', 17, true))).toMatch(/black-joker.webp$/);
    expect(cardFaceUrl(new Card('None', 18, true))).toMatch(/red-joker.webp$/);
  });
});
