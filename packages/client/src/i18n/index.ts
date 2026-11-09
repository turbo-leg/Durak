import { useSyncExternalStore } from 'react';
import { MN, MN_SERVER_PATTERNS } from './mn';

/**
 * The UI speaks English or Mongolian. English text is the key, so `t('Pick up')` reads
 * naturally in code and falls back to English when a phrase has no translation yet.
 * Placeholders use braces: `t('{name} wins.', { name })`.
 */
export type Lang = 'en' | 'mn';
const STORAGE_KEY = 'durak_lang';

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** `?lang=mn` on a shared link wins, then the player's saved choice, then the device language. */
function initialLang(): Lang {
  if (typeof window !== 'undefined') {
    const fromLink = new URLSearchParams(window.location.search).get('lang');
    if (fromLink === 'mn' || fromLink === 'en') {
      safeStorage()?.setItem(STORAGE_KEY, fromLink);
      return fromLink;
    }
  }
  const saved = safeStorage()?.getItem(STORAGE_KEY);
  if (saved === 'mn' || saved === 'en') return saved;
  const device =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return device.some((code) => code?.toLowerCase().startsWith('mn')) ? 'mn' : 'en';
}

let lang: Lang = initialLang();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = () => lang;

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  safeStorage()?.setItem(STORAGE_KEY, next);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Re-renders the calling component when the language changes. */
export const useLang = () => useSyncExternalStore(subscribe, getLang, getLang);

const fill = (text: string, vars?: Record<string, string | number>) =>
  vars
    ? text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
    : text;

export function t(text: string, vars?: Record<string, string | number>): string {
  return fill(lang === 'mn' ? (MN[text] ?? text) : text, vars);
}

/** Server notices and errors arrive in English; translate the ones we know. */
export function tServer(message: string | null | undefined): string {
  if (!message || lang !== 'mn') return message ?? '';
  const exact = MN[message];
  if (exact) return exact;
  for (const [pattern, template] of MN_SERVER_PATTERNS) {
    const match = message.match(pattern);
    if (match) return template.replace(/\$(\d)/g, (_, n: string) => match[Number(n)] ?? '');
  }
  return message;
}

/** For tests: the language store is module state. */
export function resetLangForTests(next: Lang = 'en') {
  lang = next;
}
