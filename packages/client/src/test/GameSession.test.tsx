import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '@durak/shared';
import { GameProvider, useGame } from '../contexts/GameContext';
import { isSessionTokenCurrent } from '../game/sessionToken';

const mocks = vi.hoisted(() => ({
  join: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  logout: vi.fn(),
  clearDiscord: vi.fn(),
  token: '',
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { token: mocks.token },
    logout: mocks.logout,
  }),
}));
vi.mock('../discordAuth', () => ({
  discordSdk: null,
  getDiscordSessionToken: () => undefined,
  clearDiscordSessionToken: mocks.clearDiscord,
}));
vi.mock('colyseus.js', () => ({
  Client: class {
    create = mocks.create;
    joinById = mocks.join;
    joinOrCreate = mocks.find;
  },
}));

const token = (exp: number) => `header.${btoa(JSON.stringify({ exp }))}.signature`;
function Controls() {
  const game = useGame();
  return (
    <>
      <button onClick={() => void game.createGame({ username: 'Guest' })}>create</button>
      <button onClick={() => void game.joinGame('room', undefined, 'old-id', 'Guest')}>join</button>
      <button onClick={() => void game.spectateGame('room')}>watch</button>
      <button onClick={() => void game.joinOrCreateGame({ username: 'Guest' })}>find</button>
      <button onClick={() => void game.autoJoinDiscordRoom('instance', 'Guest', '', 'old-id')}>
        discord
      </button>
      <span>{game.error}</span>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  const room = {
    roomId: 'room',
    sessionId: 'me',
    state: new GameState(),
    onStateChange: vi.fn(),
    onMessage: vi.fn(),
    onError: vi.fn(),
    onLeave: vi.fn(),
    send: vi.fn(),
    connection: { isOpen: false },
    leave: vi.fn(),
  };
  for (const join of [mocks.join, mocks.create, mocks.find])
    join.mockReset().mockResolvedValue(room);
  mocks.token = token(Date.now() / 1000 - 60);
});

describe('expired-session join recovery', () => {
  it.each(['create', 'join', 'watch', 'find', 'discord'])(
    'joins as a guest through %s after local expiry',
    async (action) => {
      render(
        <GameProvider>
          <Controls />
        </GameProvider>,
      );
      await act(async () => fireEvent.click(screen.getByText(action)));
      const join =
        action === 'create'
          ? mocks.create
          : action === 'watch' || action === 'join'
            ? mocks.join
            : mocks.find;
      const options = join.mock.calls[0]![1];
      expect(options.token).toBeUndefined();
      expect(options.userId).toBeUndefined();
      expect(options.discordId).toBeUndefined();
      expect(mocks.logout).toHaveBeenCalled();
    },
  );

  it('retries a server-rejected session once as a guest without claimed identity', async () => {
    mocks.token = token(Date.now() / 1000 + 60);
    mocks.join.mockRejectedValueOnce(new Error('Invalid or expired session token'));
    render(
      <GameProvider>
        <Controls />
      </GameProvider>,
    );
    await act(async () => fireEvent.click(screen.getByText('join')));
    expect(mocks.join).toHaveBeenCalledTimes(2);
    expect(mocks.join.mock.calls[0]![1].token).toBe(mocks.token);
    expect(mocks.join.mock.calls[1]![1]).not.toHaveProperty('token');
    expect(mocks.join.mock.calls[1]![1]).not.toHaveProperty('userId');
    expect(mocks.logout).toHaveBeenCalledOnce();
  });

  it('does not retry unrelated join errors or clear a current session', async () => {
    mocks.token = token(Date.now() / 1000 + 60);
    mocks.join.mockRejectedValueOnce(new Error('Room is full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <GameProvider>
        <Controls />
      </GameProvider>,
    );
    await act(async () => fireEvent.click(screen.getByText('join')));
    expect(mocks.join).toHaveBeenCalledTimes(1);
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(screen.getByText('Room is full')).toBeVisible();
    vi.restoreAllMocks();
  });

  it('treats malformed, missing-expiry and expired payloads as unusable client sessions', () => {
    expect(isSessionTokenCurrent('broken')).toBe(false);
    expect(isSessionTokenCurrent('x.e30.y')).toBe(false);
    expect(isSessionTokenCurrent(token(1))).toBe(false);
    expect(isSessionTokenCurrent(token(Date.now() / 1000 + 60))).toBe(true);
  });
});
