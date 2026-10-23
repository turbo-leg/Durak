export const AVATAR_PRESETS = [
  {
    id: 'copper',
    name: 'Copper',
    skin: '#bc825e',
    hair: '#30241f',
    shirt: '#ab6751',
    hairStyle: 0,
  },
  { id: 'sage', name: 'Sage', skin: '#e6b493', hair: '#46352c', shirt: '#668b78', hairStyle: 1 },
  {
    id: 'indigo',
    name: 'Indigo',
    skin: '#805139',
    hair: '#201c24',
    shirt: '#687da7',
    hairStyle: 2,
  },
  { id: 'ochre', name: 'Ochre', skin: '#d5a37f', hair: '#b17b42', shirt: '#b59152', hairStyle: 3 },
  {
    id: 'casual',
    name: 'Casual',
    skin: '#d9ac8a',
    hair: '#49392d',
    shirt: '#648698',
    hairStyle: 0,
  },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id'];

/** How a character looks: colours, a hair style and, optionally, a lip colour. */
export interface AvatarLook {
  id: string;
  name: string;
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: number;
  lip?: string;
}

/**
 * The bots, in the order they join a table, each with a look of their own (not offered to
 * players). Jagaa and Tsomo are women, with long hair and a ponytail; Dok is Black.
 */
export const BOT_AVATARS: readonly AvatarLook[] = [
  {
    id: 'bot-orgil',
    name: 'Orgil',
    skin: '#ecc5a2',
    hair: '#1b1613',
    shirt: '#3f5f8a',
    hairStyle: 0,
  },
  {
    id: 'bot-jagaa',
    name: 'Jagaa',
    skin: '#f2cdab',
    hair: '#17120f',
    shirt: '#b5506a',
    hairStyle: 5,
    lip: '#c0606a',
  },
  {
    id: 'bot-mugii',
    name: 'Mugii',
    skin: '#e6bb97',
    hair: '#211a16',
    shirt: '#5f8a62',
    hairStyle: 3,
  },
  { id: 'bot-dok', name: 'Dok', skin: '#5a3824', hair: '#110d0b', shirt: '#c9a14a', hairStyle: 2 },
  {
    id: 'bot-tsomo',
    name: 'Tsomo',
    skin: '#efc7a3',
    hair: '#2a1d17',
    shirt: '#7a5ea8',
    hairStyle: 6,
    lip: '#b85a68',
  },
];

/** A bot's look from its name; a repeated name ("Orgil 2") looks like the first. */
export function botAvatar(name: string) {
  return BOT_AVATARS.find((look) => name === look.name || name.startsWith(`${look.name} `));
}

export const LOOK_YAW_LIMIT = (65 * Math.PI) / 180;
export const LOOK_PITCH_MIN = (-25 * Math.PI) / 180;
export const LOOK_PITCH_MAX = (20 * Math.PI) / 180;
export const LOOK_INTERVAL_MS = 100;
export function isAvatarPreset(value: unknown): value is AvatarPresetId {
  return AVATAR_PRESETS.some((preset) => preset.id === value);
}
/** A player's preset or a bot's look by id; an unknown id gets the first preset. */
export function avatarPreset(value: unknown): AvatarLook {
  return (
    AVATAR_PRESETS.find((preset) => preset.id === value) ??
    BOT_AVATARS.find((look) => look.id === value) ??
    AVATAR_PRESETS[0]
  );
}

/** Manual, public emotes. Never inferred from a player's private cards. */
export const GESTURES = [
  { id: 'one', label: 'One finger' },
  { id: 'two', label: 'Two fingers' },
  { id: 'three', label: 'Three fingers' },
  { id: 'four', label: 'Four fingers' },
  { id: 'nose', label: 'Touch nose' },
  { id: 'ear-left', label: 'Touch left ear' },
  { id: 'ear-right', label: 'Touch right ear' },
  { id: 'cry', label: 'Cry' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'shrug', label: 'Shrug' },
] as const;
export type GestureId = (typeof GESTURES)[number]['id'];
export const GESTURE_DURATION_MS = 2000;
export const GESTURE_COOLDOWN_MS = 3000;
export function isGesture(value: unknown): value is GestureId {
  return GESTURES.some((gesture) => gesture.id === value);
}
export function gestureLabel(value: string): string {
  return GESTURES.find((gesture) => gesture.id === value)?.label ?? '';
}
export interface PublicGesture {
  gestureId?: string;
  gestureStartedAt?: number;
  gestureSequence?: number;
}
/** An expired snapshot must not restart an emote on reconnect or late asset load. */
export function gestureWeight(gesture: PublicGesture, now: number, reduced = false): number {
  if (!isGesture(gesture.gestureId) || !gesture.gestureStartedAt) return 0;
  const age = now - gesture.gestureStartedAt;
  if (age < 0 || age >= GESTURE_DURATION_MS) return 0;
  if (reduced) return 1;
  const t = Math.min(1, age / 250, (GESTURE_DURATION_MS - age) / 250);
  return t * t * (3 - 2 * t);
}
