import type { Room } from 'colyseus.js';
import type { PrivateView } from '@durak/shared';

/** Everything a test client was sent outside synced state. */
export interface Inbox {
  /** The latest 'private' view, or null if none was ever sent. */
  view: PrivateView | null;
  privateCount: number;
  /** Every message as JSON, for canary checks. */
  raw: string[];
}

/** Records every message a client is sent. */
export function listen(room: Room): Inbox {
  const inbox: Inbox = { view: null, privateCount: 0, raw: [] };
  room.onMessage('*', (type, message) => {
    inbox.raw.push(JSON.stringify([type, message]));
    if (type === 'private') {
      inbox.view = message as PrivateView;
      inbox.privateCount++;
    }
  });
  return inbox;
}
