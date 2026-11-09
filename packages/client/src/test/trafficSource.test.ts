import { afterEach, describe, expect, it } from 'vitest';
import { trafficSource } from '../game/trafficSource';

const visit = (search: string) => window.history.replaceState(null, '', `/${search}`);

afterEach(() => {
  sessionStorage.clear();
  visit('');
});

describe('trafficSource', () => {
  it('reads ?src= and remembers it for the rest of the visit', () => {
    visit('?src=pp_fb_phone&lang=mn');
    expect(trafficSource()).toBe('pp_fb_phone');
    visit('');
    expect(trafficSource()).toBe('pp_fb_phone');
  });

  it('ignores anything that is not a short plain tag', () => {
    visit('?src=<script>');
    expect(trafficSource()).toBeUndefined();
    visit(`?src=${'x'.repeat(41)}`);
    expect(trafficSource()).toBeUndefined();
  });

  it('is undefined for a direct visit', () => {
    expect(trafficSource()).toBeUndefined();
  });
});
