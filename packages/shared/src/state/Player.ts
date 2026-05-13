import { type, Schema, ArraySchema } from '@colyseus/schema';
import { Card } from './Card';

export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') username: string = '';
  @type('string') avatarUrl: string = '';
  @type('string') discordId: string = '';
  @type('string') userId: string = ''; // internal ID for email/password accounts
  @type([Card]) hand = new ArraySchema<Card>();
  @type(['string']) pickedUpCardKeys = new ArraySchema<string>();
  @type('boolean') hasPickedUp: boolean = false;
  @type('number') team: number = 0; // 0 or 1 for 3v3
  @type('boolean') isReady: boolean = false;
  @type(['string']) lastDrawLog = new ArraySchema<string>();

  constructor(id: string = '') {
    super();
    this.id = id;
  }
}
