import { BOT_AVATARS, botAvatar } from '@durak/shared';

/** Names bots take at the table, in order. */
export const BOT_NAMES = BOT_AVATARS.map((look) => look.name);

/** The first bot name nobody at the table has; past the list, names repeat with a number. */
export function nextBotName(taken: Iterable<string>) {
  const used = new Set(taken);
  for (let round = 1; ; round++)
    for (const name of BOT_NAMES) {
      const candidate = round === 1 ? name : `${name} ${round}`;
      if (!used.has(candidate)) return candidate;
    }
}

/** A new bot's name and the look that goes with it. */
export function nextBot(taken: Iterable<string>) {
  const name = nextBotName(taken);
  return { name, avatarPreset: botAvatar(name)!.id };
}
