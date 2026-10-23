/** Private-table phases: waiting → countdown → opening → playing → finished. */
export const COUNTDOWN_MS = 3000;
export const OPENING_MS = 4000;
/** A disconnected private-table seat is played by an Easy stand-in after this grace. */
export const TAKEOVER_GRACE_MS = 5000;

export type SeatControl = 'human' | 'bot' | 'standin';
