import { type, Schema } from '@colyseus/schema';

/** A watcher waiting for the next free seat at a private table, in arrival order. */
export class SeatRequest extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';

  constructor(id: string = '', name: string = '') {
    super();
    this.id = id;
    this.name = name;
  }
}
