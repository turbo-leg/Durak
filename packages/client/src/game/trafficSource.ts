/**
 * Where this visit came from, e.g. `pp_fb_phone` from a «Постын Паян» Facebook post link
 * (`?src=pp_fb_phone`). Remembered for the browser tab, so a player who arrives from a post
 * and starts a game a few minutes later is still counted. The server only logs it.
 */
const KEY = 'durak_src';
const VALID = /^[a-z0-9_-]{1,40}$/i;

export function trafficSource(): string | undefined {
  try {
    const fromLink = new URLSearchParams(window.location.search).get('src');
    if (fromLink && VALID.test(fromLink)) {
      sessionStorage.setItem(KEY, fromLink);
      return fromLink;
    }
    const saved = sessionStorage.getItem(KEY);
    return saved && VALID.test(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}
