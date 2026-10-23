export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface RoomSettings {
  mode: string;
  maxPlayers: number;
  targetHandSize: number;
  teamSelection: string;
}

function integer(value: unknown): number {
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return typeof value === 'number' && Number.isInteger(value) ? value : NaN;
}

export function roomSettings(input: unknown, current?: RoomSettings): RoomSettings {
  if (!isRecord(input)) throw new Error('Room settings must be an object');
  const mode = input.mode ?? current?.mode ?? 'classic';
  const maxPlayers = integer(input.maxPlayers ?? current?.maxPlayers ?? 6);
  const targetHandSize = integer(
    input.targetHandSize ?? input.handSize ?? current?.targetHandSize ?? 5,
  );
  const teamSelection = input.teamSelection ?? current?.teamSelection ?? 'random';
  if (typeof mode !== 'string' || !['classic', 'teams', 'horse'].includes(mode)) {
    throw new Error('Unsupported game mode');
  }
  if (![2, 3, 4, 5, 6].includes(maxPlayers)) throw new Error('Player capacity must be 2 to 6');
  if (mode !== 'classic' && ![4, 6].includes(maxPlayers)) {
    throw new Error('Teams and Horse require 4 or 6 seats');
  }
  if (![5, 7].includes(targetHandSize)) throw new Error('Hand size must be 5 or 7');
  if (teamSelection !== 'random' && teamSelection !== 'manual')
    throw new Error('Unsupported team selection');
  return { mode, maxPlayers, targetHandSize, teamSelection };
}
