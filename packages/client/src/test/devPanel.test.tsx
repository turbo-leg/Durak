import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, Player } from '@durak/shared';
import DevPanel from '../room/DevPanel';

const send = vi.fn();
const game: Record<string, unknown> = {};
vi.mock('../contexts/GameContext', () => ({ useGame: () => game }));

function table() {
  const state = new GameState();
  state.hostId = 'me';
  state.isPrivate = true;
  state.maxPlayers = 4;
  const me = new Player('me');
  me.username = 'Ana';
  const bot = new Player('bot-1');
  bot.username = 'Orgil';
  bot.control = 'bot';
  state.players.set('me', me);
  state.players.set('bot-1', bot);
  return state;
}

const toggle = () => act(() => void fireEvent.keyDown(window, { key: '`' }));

describe('Dev panel', () => {
  beforeEach(() => {
    localStorage.clear();
    send.mockClear();
    Object.assign(game, {
      room: { roomId: 'abc', sessionId: 'me', send },
      gameState: table(),
      createGame: vi.fn(),
      startLobbyGame: vi.fn(),
    });
  });
  afterEach(() => localStorage.clear());

  it('stays hidden until the backtick key, and remembers being open', () => {
    const { unmount } = render(<DevPanel />);
    expect(screen.queryByLabelText('Developer tools')).toBeNull();
    toggle();
    expect(screen.getByLabelText('Developer tools')).toBeTruthy();
    unmount();
    render(<DevPanel />);
    expect(screen.getByLabelText('Developer tools')).toBeTruthy();
  });

  it('shows the room and its seats, and fills empty seats with bots', () => {
    render(<DevPanel />);
    toggle();
    expect(screen.getByText(/abc \(private\)/)).toBeTruthy();
    expect(screen.getByText('Orgil')).toBeTruthy();
    fireEvent.click(screen.getByText('Fill with hard bots'));
    // Two empty seats on a private table: two bots, through the real add-bot message.
    expect(send.mock.calls).toEqual([
      ['addBot', { difficulty: 'hard' }],
      ['addBot', { difficulty: 'hard' }],
    ]);
  });

  it('only lets the host change the table', () => {
    (game.room as { sessionId: string }).sessionId = 'guest';
    render(<DevPanel />);
    toggle();
    expect((screen.getByText('Fill with easy bots') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Start game') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers a new table when not in a room', () => {
    Object.assign(game, { room: null, gameState: null });
    render(<DevPanel />);
    toggle();
    fireEvent.click(screen.getByText('New private table (6 seats)'));
    expect(game.createGame).toHaveBeenCalledWith(
      expect.objectContaining({ isPrivate: true, maxPlayers: 6 }),
    );
  });
});
