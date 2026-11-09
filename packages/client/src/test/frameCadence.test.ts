import { describe, expect, it } from 'vitest';
import { FrameCadence } from '../components/three/frameCadence';

function frames(refresh: number, budget: number) {
  const cadence = new FrameCadence();
  let rendered = 0;
  for (let tick = 0; tick < refresh * 5; tick++) {
    if (cadence.shouldRender((tick * 1000) / refresh, budget)) rendered++;
  }
  return rendered;
}

describe('table render cadence', () => {
  it.each([60, 120, 144, 240])('keeps the desktop budget on a %i Hz display', (refresh) => {
    expect(frames(refresh, 60)).toBeGreaterThanOrEqual(299);
    expect(frames(refresh, 60)).toBeLessThanOrEqual(301);
  });

  it('keeps the mobile budget on a high refresh display', () => {
    expect(frames(120, 30)).toBe(150);
  });

  it('renders immediately after an idle gap or quality change without a catch-up burst', () => {
    const cadence = new FrameCadence();
    expect(cadence.shouldRender(0, 60)).toBe(true);
    expect(cadence.shouldRender(5000, 60)).toBe(true);
    expect(cadence.shouldRender(5001, 60)).toBe(false);
    expect(cadence.shouldRender(5002, 30)).toBe(true);
    expect(cadence.shouldRender(5003, 30)).toBe(false);
  });
});
