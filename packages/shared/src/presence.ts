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
export const LOOK_YAW_LIMIT = (65 * Math.PI) / 180;
export const LOOK_PITCH_MIN = (-25 * Math.PI) / 180;
export const LOOK_PITCH_MAX = (20 * Math.PI) / 180;
export const LOOK_INTERVAL_MS = 100;
export function isAvatarPreset(value: unknown): value is AvatarPresetId {
  return AVATAR_PRESETS.some((preset) => preset.id === value);
}
export function avatarPreset(value: unknown) {
  return AVATAR_PRESETS.find((preset) => preset.id === value) ?? AVATAR_PRESETS[0];
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
