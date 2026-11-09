import { type, Schema } from '@colyseus/schema';
import { Card } from './Card';

export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') username: string = '';
  @type('string') avatarUrl: string = '';
  @type('string') avatarPreset: string = 'copper';
  @type('float32') headYaw: number = 0;
  @type('float32') headPitch: number = 0;
  @type('uint32') playSequence: number = 0;
  @type('string') gestureId: string = '';
  @type('number') gestureStartedAt: number = 0;
  @type('uint32') gestureSequence: number = 0;
  @type('string') discordId: string = '';
  @type('string') userId: string = ''; // internal ID for email/password accounts
  // Private, server-only. The owner receives it in a 'private' message sent just
  // before each patch (see DurakRoom.sendPrivateViews). Keeping it out of the
  // schema means state has no @filter, so one patch is encoded for all clients.
  hand: Card[] = [];
  pickedUpCardKeys: string[] = [];
  @type('boolean') hasPickedUp: boolean = false;
  @type('number') team: number = 0; // 0 or 1 for 3v3
  @type('boolean') isReady: boolean = false;
  lastDrawLog: string[] = []; // server-only

  // Public count is maintained by the authoritative room before each patch.
  @type('number') handCount: number = 0;

  // Who drives this seat: 'human', a permanent 'bot', or a temporary 'standin'.
  @type('string') control: string = 'human';
  @type('boolean') connected: boolean = true;

  constructor(id: string = '') {
    super();
    this.id = id;
  }
}
