import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lobby } from '../components/Lobby';
import * as GameContextModule from '../contexts/GameContext';

// ─── mock GameContext ────────────────────────────────────────────────────────

function mockGameContext(overrides: Partial<ReturnType<typeof GameContextModule.useGame>> = {}) {
  vi.spyOn(GameContextModule, 'useGame').mockReturnValue({
    client: null,
    room: null,
    error: null,
    isConnected: false,
    isReconnecting: false,
    gameState: null,
    gameMessage: null,
    clearGameMessage: vi.fn(),
    defenseSnapshot: null,
    suhuhResult: null,
    clearSuhuhResult: vi.fn(),
    discardedCards: null,
    clearDiscardedCards: vi.fn(),
    isSpectator: false,
    createGame: vi.fn().mockResolvedValue(undefined),
    joinGame: vi.fn().mockResolvedValue(undefined),
    spectateGame: vi.fn().mockResolvedValue(undefined),
    findPublicGames: vi.fn().mockResolvedValue([]),
    leaveGame: vi.fn(),
    autoJoinDiscordRoom: vi.fn().mockResolvedValue(undefined),
    updateLobbySettings: vi.fn(),
    startLobbyGame: vi.fn(),
    serverTimeOffset: 0,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── tests ───────────────────────────────────────────────────────────────────

describe('Lobby component', () => {
  describe('rendering', () => {
    it('renders the Create New Game panel', async () => {
      mockGameContext();
      render(<Lobby />);
      expect(screen.getByText('Create New Game')).toBeInTheDocument();
      await waitFor(() => {}); // flush fetchRooms state update
    });

    it('renders the Join Private Game panel', async () => {
      mockGameContext();
      render(<Lobby />);
      expect(screen.getByText('Join Private Game')).toBeInTheDocument();
      await waitFor(() => {});
    });

    it('renders the Public Lobbies panel', async () => {
      mockGameContext();
      render(<Lobby />);
      expect(screen.getByText('Public Lobbies')).toBeInTheDocument();
      await waitFor(() => {});
    });

    it('displays an error message from context', async () => {
      mockGameContext({ error: 'Room not found' });
      render(<Lobby />);
      expect(screen.getByText(/room not found/i)).toBeInTheDocument();
      await waitFor(() => {});
    });
  });

  describe('Create game', () => {
    it('calls createGame with default options on submit', async () => {
      const user = userEvent.setup();
      const createGame = vi.fn().mockResolvedValue(undefined);
      mockGameContext({ createGame });

      render(<Lobby />);
      await waitFor(() => {}); // flush initial fetchRooms

      await user.click(screen.getByRole('button', { name: /create & join game/i }));

      await waitFor(() => {
        expect(createGame).toHaveBeenCalledOnce();
        expect(createGame).toHaveBeenCalledWith(
          expect.objectContaining({
            maxPlayers: expect.any(Number),
            mode: expect.any(String),
          }),
        );
      });
    });

    it('shows "Creating..." while loading', async () => {
      const user = userEvent.setup();
      let resolveCreate!: () => void;
      const createGame = vi.fn(
        () =>
          new Promise<void>((res) => {
            resolveCreate = res;
          }),
      );
      mockGameContext({ createGame });

      render(<Lobby />);
      await waitFor(() => {});

      await user.click(screen.getByRole('button', { name: /create & join game/i }));

      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
      resolveCreate();
    });

    it('passes isPrivate=true when private toggle is checked', async () => {
      const user = userEvent.setup();
      const createGame = vi.fn().mockResolvedValue(undefined);
      mockGameContext({ createGame });

      render(<Lobby />);
      await waitFor(() => {});

      await user.click(screen.getByLabelText(/private game/i));
      await user.click(screen.getByRole('button', { name: /create & join game/i }));

      await waitFor(() => {
        expect(createGame).toHaveBeenCalledWith(expect.objectContaining({ isPrivate: true }));
      });
    });
  });

  describe('Join by room code', () => {
    it('calls joinGame with the entered room code', async () => {
      const user = userEvent.setup();
      const joinGame = vi.fn().mockResolvedValue(undefined);
      mockGameContext({ joinGame });

      render(<Lobby />);
      await waitFor(() => {});

      const input = screen.getByPlaceholderText(/enter room code/i);
      await user.type(input, 'ABC123');
      // Click the first "Join" button (the one in the join-by-code form)
      const joinButtons = screen.getAllByRole('button', { name: /^join$/i });
      await user.click(joinButtons[0]!);

      await waitFor(() => {
        expect(joinGame).toHaveBeenCalledWith('ABC123');
      });
    });

    it('does not call joinGame when room code is empty', async () => {
      const user = userEvent.setup();
      const joinGame = vi.fn().mockResolvedValue(undefined);
      mockGameContext({ joinGame });

      render(<Lobby />);
      await waitFor(() => {});

      const joinButtons = screen.getAllByRole('button', { name: /^join$/i });
      await user.click(joinButtons[0]!);

      expect(joinGame).not.toHaveBeenCalled();
    });

    it('trims whitespace from the room code', async () => {
      const user = userEvent.setup();
      const joinGame = vi.fn().mockResolvedValue(undefined);
      mockGameContext({ joinGame });

      render(<Lobby />);
      await waitFor(() => {});

      const input = screen.getByPlaceholderText(/enter room code/i);
      await user.type(input, '  XY99  ');
      const joinButtons = screen.getAllByRole('button', { name: /^join$/i });
      await user.click(joinButtons[0]!);

      await waitFor(() => {
        expect(joinGame).toHaveBeenCalledWith('XY99');
      });
    });
  });

  describe('Watch button', () => {
    const room = {
      roomId: 'ROOM01',
      clients: 2,
      maxClients: 100,
      metadata: { playerCount: 2, maxPlayers: 6, spectatorCount: 0, mode: 'classic' },
    };

    it('is disabled when phase is not playing', async () => {
      mockGameContext({
        findPublicGames: vi
          .fn()
          .mockResolvedValue([{ ...room, metadata: { ...room.metadata, phase: 'waiting' } }]),
      });
      render(<Lobby />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /watch/i })).toBeInTheDocument(),
      );
      expect(screen.getByRole('button', { name: /watch/i })).toBeDisabled();
    });

    it('calls spectateGame with the roomId when phase is playing', async () => {
      const user = userEvent.setup();
      const spectateGame = vi.fn().mockResolvedValue(undefined);
      mockGameContext({
        spectateGame,
        findPublicGames: vi
          .fn()
          .mockResolvedValue([{ ...room, metadata: { ...room.metadata, phase: 'playing' } }]),
      });
      render(<Lobby />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /watch/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: /watch/i }));
      await waitFor(() => expect(spectateGame).toHaveBeenCalledWith('ROOM01'));
    });
  });

  describe('public room list', () => {
    it('shows "No public games" when the list is empty', async () => {
      mockGameContext({ findPublicGames: vi.fn().mockResolvedValue([]) });
      render(<Lobby />);

      await waitFor(() => {
        expect(screen.getByText(/no public games available/i)).toBeInTheDocument();
      });
    });

    it('shows available public rooms with their IDs (first 6 chars)', async () => {
      const findPublicGames = vi
        .fn()
        .mockResolvedValue([
          { roomId: 'ABCDEF99', metadata: { mode: 'classic' }, clients: 2, maxClients: 6 },
        ]);
      mockGameContext({ findPublicGames });

      render(<Lobby />);

      // Lobby displays roomId.substring(0, 6) + "..."
      await waitFor(() => {
        expect(screen.getByText(/ABCDEF/)).toBeInTheDocument();
      });
    });
  });
});
