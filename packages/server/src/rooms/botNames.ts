import { BOT_AVATARS, botAvatar } from '@durak/shared';

/** Names bots take at the table. */
export const BOT_NAMES = BOT_AVATARS.map((look) => look.name);

/**
 * A bot name nobody at the table has, chosen at random so every bot turns up across games;
 * past the list, names repeat with a number.
 */
export function nextBotName(taken: Iterable<string>, random = Math.random) {
  const used = new Set(taken);
  for (let round = 1; ; round++) {
    const free = BOT_NAMES.map((name) => (round === 1 ? name : `${name} ${round}`)).filter(
      (name) => !used.has(name),
    );
    if (free.length) return free[Math.floor(random() * free.length)]!;
  }
}

/** A new bot's name and the look that goes with it. */
export function nextBot(taken: Iterable<string>, random = Math.random) {
  const name = nextBotName(taken, random);
  return { name, avatarPreset: botAvatar(name)!.id };
}
