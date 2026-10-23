/** Names bots take at the table, in order. */
export const BOT_NAMES = ['Orgil', 'Jagaa', 'Mugii', 'Dok', 'Tsomo'] as const;

/** The first bot name nobody at the table has; past the list, names repeat with a number. */
export function nextBotName(taken: Iterable<string>) {
  const used = new Set(taken);
  for (let round = 1; ; round++)
    for (const name of BOT_NAMES) {
      const candidate = round === 1 ? name : `${name} ${round}`;
      if (!used.has(candidate)) return candidate;
    }
}
