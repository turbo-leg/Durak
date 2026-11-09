import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameState, Player } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { queueMatchResult } from '../src/operations/matchResults';

vi.mock('../src/operations/matchResults', () => ({ queueMatchResult: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('result recovery across the next deal', () => {
  it('retains the completed match snapshot when the room changes before its queued write runs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const room = new DurakRoom();
    room.roomId = 'original-room';
    room.setState(new GameState());
    room.state.phase = 'finished';
    room.state.mode = 'classic';
    room.state.huzurSuit = 'Hearts';
    const winner = new Player('winner');
    winner.username = 'Original winner';
    winner.discordId = '123456789012345678';
    room.state.players.set(winner.id, winner);
    room.state.winners.push(winner.id);
    room.state.actionLog.push('original move');

    await (room as unknown as { saveGameLog(): Promise<void> }).saveGameLog();
    const queued = vi.mocked(queueMatchResult).mock.calls[0];
    expect(queued).toBeDefined();
    const [snapshot] = queued!;

    winner.username = 'Changed player';
    winner.discordId = '987654321098765432';
    room.state.players.clear();
    room.state.winners.clear();
    room.state.actionLog.length = 0;
    room.state.mode = 'horse';
    room.state.huzurSuit = 'Spades';

    expect(snapshot).toMatchObject({
      completed: true,
      mode: 'classic',
      winnerSessions: ['winner'],
      players: [{ username: 'Original winner', discordId: '123456789012345678' }],
      log: {
        roomId: 'original-room',
        mode: 'classic',
        discordIds: ['123456789012345678'],
        winners: ['123456789012345678'],
        huzurSetting: 'Hearts',
        actionLog: ['original move'],
      },
    });
    expect(snapshot.id).toMatch(/^[a-f0-9]{24}$/);
  });
});
