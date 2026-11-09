export interface CapacityLimits {
  maxRooms: number;
  maxClients: number;
  maxBots: number;
}

export class CapacityError extends Error {
  readonly code = 503;
  constructor() {
    super('The server is full. Please try again shortly.');
    this.name = 'CapacityError';
  }
}

interface RoomClaims {
  clients: Set<string>;
  bots: Set<string>;
}

/** Local admission budget. Existing seats and reconnects retain their claims. */
export class ProcessCapacity {
  private rooms = new Map<string, RoomClaims>();
  private clients = 0;
  private bots = 0;

  constructor(private readonly limits: CapacityLimits) {
    for (const value of Object.values(limits))
      if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid capacity limit');
  }

  claimRoom(roomId: string): void {
    if (this.rooms.has(roomId)) return;
    if (this.rooms.size >= this.limits.maxRooms) throw new CapacityError();
    this.rooms.set(roomId, { clients: new Set(), bots: new Set() });
  }

  releaseRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.clients -= room.clients.size;
    this.bots -= room.bots.size;
    this.rooms.delete(roomId);
  }

  assertAvailableClient(roomId?: string, clientId?: string): void {
    if (roomId && clientId && this.rooms.get(roomId)?.clients.has(clientId)) return;
    if (this.clients >= this.limits.maxClients) throw new CapacityError();
  }

  claimClient(roomId: string, clientId: string): void {
    const room = this.room(roomId);
    if (room.clients.has(clientId)) return;
    this.assertAvailableClient();
    room.clients.add(clientId);
    this.clients++;
  }

  releaseClient(roomId: string, clientId: string): void {
    if (this.rooms.get(roomId)?.clients.delete(clientId)) this.clients--;
  }

  claimBot(roomId: string, botId: string): void {
    const room = this.room(roomId);
    if (room.bots.has(botId)) return;
    if (this.bots >= this.limits.maxBots) throw new CapacityError();
    room.bots.add(botId);
    this.bots++;
  }

  releaseBot(roomId: string, botId: string): void {
    if (this.rooms.get(roomId)?.bots.delete(botId)) this.bots--;
  }

  snapshot() {
    return { rooms: this.rooms.size, clients: this.clients, bots: this.bots, ...this.limits };
  }

  private room(roomId: string): RoomClaims {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room has no capacity reservation');
    return room;
  }
}

function limit(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid ${name}`);
  return parsed;
}

export const processCapacity = new ProcessCapacity({
  maxRooms: limit('MAX_ACTIVE_ROOMS', 120),
  maxClients: limit('MAX_CONNECTED_CLIENTS', 150),
  maxBots: limit('MAX_ACTIVE_BOTS', 120),
});
