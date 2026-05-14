import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameBoard } from '../components/GameBoard';
import * as GameContextModule from '../contexts/GameContext';
import { Card, GameState, Player } from '@durak/shared';
import { MapSchema, ArraySchema } from '@colyseus/schema';

// ─── module-level mocks ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMotionComponent(tag: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return React.forwardRef(({ children, ...props }: any, ref: any) => {
    // Drop framer-specific props to avoid React DOM warnings
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      layoutId: _layoutId,
      whileHover: _whileHover,
      whileTap: _whileTap,
      style: _style,
      ...domProps
    } = props;
    void _initial;
    void _animate;
    void _exit;
    void _transition;
    void _variants;
    void _layoutId;
    void _whileHover;
    void _whileTap;
    void _style;
    return React.createElement(tag, { ...domProps, ref }, children);
  });
}

vi.mock('framer-motion', () => ({
  motion: new Proxy({} as Record<string, unknown>, {
    get: (_target, tag: string) => makeMotionComponent(tag),
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn().mockResolvedValue(undefined) },
  ImpactStyle: { Light: 'LIGHT' },
}));

vi.mock('../utils/audio', () => ({
  useAudio: () => ({
    playDealSound: vi.fn(),
    playCardSound: vi.fn(),
    playPickupSound: vi.fn(),
    playTimerWarning: vi.fn(),
    playVictorySound: vi.fn(),
    playDefeatSound: vi.fn(),
    playDiscardSound: vi.fn(),
  }),
}));

vi.mock('../utils/useIsDesktop', () => ({
  useIsDesktop: () => false,
}));

vi.mock('../components/SuhuhReveal', () => ({
  SuhuhReveal: () => null,
}));

vi.mock('../components/PlayerProfilePanel', () => ({
  PlayerProfilePanel: () => null,
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeCard(suit: string, rank: number, isJoker = false): Card {
  return new Card(suit, rank, isJoker);
}

function makePlayer(
  id: string,
  opts: { username?: string; isReady?: boolean; hand?: Card[]; team?: number } = {},
): Player {
  const p = new Player(id);
  p.username = opts.username ?? id;
  p.isReady = opts.isReady ?? false;
  p.team = opts.team ?? 0;
  if (opts.hand) {
    p.hand = new ArraySchema<Card>(...opts.hand);
  }
  return p;
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const gs = new GameState();
  gs.phase = 'waiting';
  gs.hostId = 'host1';
  gs.mode = 'classic';
  gs.teamSelection = 'random';
  gs.maxPlayers = 6;
  gs.targetHandSize = 5;
  gs.currentTurn = '';
  gs.huzurSuit = '';
  gs.turnTimeLimit = 30000;
  gs.turnStartTime = Date.now();
  gs.spectatorCount = 0;
  gs.deck = new ArraySchema<Card>();
  gs.activeAttackCards = new ArraySchema<Card>();
  gs.tableStacks = new ArraySchema<Card>();
  gs.seatOrder = new ArraySchema<string>();

  Object.assign(gs, overrides);
  return gs;
}

/** Minimal mock room object */
function makeRoom(sessionId: string, roomId = 'ROOM01') {
  return {
    sessionId,
    id: roomId,
    send: vi.fn(),
    onMessage: vi.fn().mockReturnValue(vi.fn()), // returns unsubscribe fn
  };
}

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

// ─── tests ────────────────────────────────────────────────────────────────────

describe('GameBoard component', () => {
  // ── null / loading state ──────────────────────────────────────────────────
  describe('null state (no room or gameState)', () => {
    it('renders nothing when room is null', () => {
      mockGameContext({ room: null, gameState: null });
      const { container } = render(<GameBoard />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when gameState is null but room exists', () => {
      mockGameContext({
        room: makeRoom('p1') as never,
        gameState: null,
      });
      const { container } = render(<GameBoard />);
      expect(container.firstChild).toBeNull();
    });
  });

  // ── waiting / lobby phase ─────────────────────────────────────────────────
  describe('waiting phase (lobby)', () => {
    function buildWaitingContext(sessionId = 'host1') {
      const players = new MapSchema<Player>();
      players.set('host1', makePlayer('host1', { username: 'Alice', isReady: false }));
      players.set('p2', makePlayer('p2', { username: 'Bob', isReady: true }));

      const gs = makeGameState({ phase: 'waiting', players });
      const room = makeRoom(sessionId);
      return { gs, room };
    }

    it('renders the Lobby heading', () => {
      const { gs, room } = buildWaitingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('Lobby')).toBeInTheDocument();
    });

    it('renders Game Settings heading', () => {
      const { gs, room } = buildWaitingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('Game Settings')).toBeInTheDocument();
    });

    it('renders player usernames in the player list', () => {
      const { gs, room } = buildWaitingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('shows a "Host" badge next to the host player', () => {
      const { gs, room } = buildWaitingContext('host1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('Host')).toBeInTheDocument();
    });

    it('shows "YOU" badge next to the current player', () => {
      const { gs, room } = buildWaitingContext('host1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('YOU')).toBeInTheDocument();
    });

    it('shows "Ready" badge for ready players', () => {
      const { gs, room } = buildWaitingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // Bob is ready
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('shows "Waiting" badge for players not yet ready', () => {
      const { gs, room } = buildWaitingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // Alice is not ready
      expect(screen.getByText('Waiting')).toBeInTheDocument();
    });

    it('shows room id in the header', () => {
      const { gs, room } = buildWaitingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('ROOM01')).toBeInTheDocument();
    });

    it('shows the START GAME button for the host', () => {
      const { gs, room } = buildWaitingContext('host1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
    });

    it('START GAME is disabled when fewer than 2 players are ready', () => {
      const { gs, room } = buildWaitingContext('host1');
      // Only Bob is ready, Alice is not — and fewer than 2 are ready
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /start game/i })).toBeDisabled();
    });

    it('shows a ready toggle button for the host', () => {
      const { gs, room } = buildWaitingContext('host1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /mark ready/i })).toBeInTheDocument();
    });

    it('non-host sees "CLICK TO READY" button', () => {
      const { gs, room } = buildWaitingContext('p2');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // p2 is ready, so button shows "READY TO PLAY"
      expect(screen.getByRole('button', { name: /ready to play/i })).toBeInTheDocument();
    });

    it('calls room.send("toggleReady") when ready button is clicked', async () => {
      const user = userEvent.setup();
      const { gs, room } = buildWaitingContext('host1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      await user.click(screen.getByRole('button', { name: /mark ready/i }));
      expect(room.send).toHaveBeenCalledWith('toggleReady', { isReady: true });
    });

    it('calls startLobbyGame when START GAME button is enabled and clicked', async () => {
      const user = userEvent.setup();

      // Make both players ready so the button is enabled
      const players = new MapSchema<Player>();
      players.set('host1', makePlayer('host1', { username: 'Alice', isReady: true }));
      players.set('p2', makePlayer('p2', { username: 'Bob', isReady: true }));
      const gs = makeGameState({ phase: 'waiting', players });
      const room = makeRoom('host1');
      const startLobbyGame = vi.fn();

      mockGameContext({ room: room as never, gameState: gs, startLobbyGame });
      render(<GameBoard />);
      await user.click(screen.getByRole('button', { name: /start game/i }));
      expect(startLobbyGame).toHaveBeenCalledOnce();
    });

    it('shows spectating indicator when isSpectator=true', () => {
      const { gs, room } = buildWaitingContext('spectator99');
      mockGameContext({ room: room as never, gameState: gs, isSpectator: true });
      render(<GameBoard />);
      expect(screen.getByText(/spectating/i)).toBeInTheDocument();
    });

    it('shows player count badge', () => {
      const { gs, room } = buildWaitingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // "2/6" player count
      expect(screen.getByText('2/6')).toBeInTheDocument();
    });
  });

  // ── playing phase ─────────────────────────────────────────────────────────
  describe('playing phase', () => {
    function buildPlayingContext(sessionId = 'p1', isMyTurn = true) {
      const myHand = [makeCard('Hearts', 12), makeCard('Spades', 11), makeCard('Clubs', 7)];
      const oppHand = [makeCard('Diamonds', 9), makeCard('Hearts', 10)];

      const myPlayer = makePlayer('p1', { username: 'Alice', isReady: true, hand: myHand });
      const oppPlayer = makePlayer('p2', { username: 'Bob', isReady: true, hand: oppHand });

      const players = new MapSchema<Player>();
      players.set('p1', myPlayer);
      players.set('p2', oppPlayer);

      const seatOrder = new ArraySchema<string>('p1', 'p2');

      const huzurCard = makeCard('Spades', 16);
      const deck = new ArraySchema<Card>(...[makeCard('Clubs', 9), makeCard('Hearts', 7)]);

      const gs = makeGameState({
        phase: 'playing',
        players,
        seatOrder,
        currentTurn: isMyTurn ? sessionId : 'p2',
        huzurCard,
        huzurSuit: 'Spades',
        deck,
      });

      const room = makeRoom(sessionId);
      return { gs, room, myHand };
    }

    it('renders "YOUR TURN" badge when it is the player\'s turn', () => {
      const { gs, room } = buildPlayingContext('p1', true);
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('YOUR TURN')).toBeInTheDocument();
    });

    it('does not render "YOUR TURN" badge when it is the opponent\'s turn', () => {
      const { gs, room } = buildPlayingContext('p1', false);
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.queryByText('YOUR TURN')).not.toBeInTheDocument();
    });

    it('renders opponent username in their seat', () => {
      const { gs, room } = buildPlayingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders opponent hand card count', () => {
      const { gs, room } = buildPlayingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // Bob has 2 cards — shown as "🃏2"
      expect(screen.getByText('🃏2')).toBeInTheDocument();
    });

    it("renders the player's hand cards", () => {
      const { gs, room } = buildPlayingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // Alice's hand: Q, J, 7 — should see at least one rank label
      expect(screen.getAllByText('Q').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('J').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the deck count in the info bar', () => {
      const { gs, room } = buildPlayingContext();
      // Use a deck size (20) that doesn't appear as a card rank label
      gs.deck = new ArraySchema<Card>(
        ...Array.from({ length: 20 }, (_, i) => makeCard('Clubs', 7 + (i % 9))),
      );
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // The info bar renders: 🃏 <span className="...">20</span>
      expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the huzur (trump) suit in the info bar', () => {
      const { gs, room } = buildPlayingContext();
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText(/Spades/i)).toBeInTheDocument();
    });

    it("renders attack button when it is the player's turn and no cards are under attack", () => {
      const { gs, room } = buildPlayingContext('p1', true);
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /attack/i })).toBeInTheDocument();
    });

    it('attack button is disabled when no cards are selected', () => {
      const { gs, room } = buildPlayingContext('p1', true);
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /attack/i })).toBeDisabled();
    });

    it("does not render action buttons when it is the opponent's turn", () => {
      const { gs, room } = buildPlayingContext('p1', false);
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      // No attack button should appear
      expect(screen.queryByRole('button', { name: /attack/i })).not.toBeInTheDocument();
    });

    it('renders defend and pick-up buttons when there are active attack cards to beat', () => {
      const { gs, room } = buildPlayingContext('p1', true);
      // Add an incoming attack card
      gs.activeAttackCards = new ArraySchema<Card>(makeCard('Diamonds', 9));
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /defend/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pick up/i })).toBeInTheDocument();
    });

    it('defend button is disabled when no cards are selected', () => {
      const { gs, room } = buildPlayingContext('p1', true);
      gs.activeAttackCards = new ArraySchema<Card>(makeCard('Diamonds', 9));
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /defend/i })).toBeDisabled();
    });

    it('sends pickUp to room when Pick Up is clicked', async () => {
      const user = userEvent.setup();
      const { gs, room } = buildPlayingContext('p1', true);
      gs.activeAttackCards = new ArraySchema<Card>(makeCard('Diamonds', 9));
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      await user.click(screen.getByRole('button', { name: /pick up/i }));
      expect(room.send).toHaveBeenCalledWith('pickUp');
    });

    it('shows the SPECTATING badge when user is a spectator', () => {
      const { gs, room } = buildPlayingContext('spectator99', false);
      mockGameContext({ room: room as never, gameState: gs, isSpectator: true });
      render(<GameBoard />);
      expect(screen.getByText(/spectating/i)).toBeInTheDocument();
    });

    it('spectator does not see the player hand panel', () => {
      const { gs, room } = buildPlayingContext('spectator99', false);
      mockGameContext({ room: room as never, gameState: gs, isSpectator: true });
      render(<GameBoard />);
      // None of Alice's hand card ranks should appear (she is p1, not us)
      // and no action buttons should be rendered
      expect(screen.queryByRole('button', { name: /attack/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /pick up/i })).not.toBeInTheDocument();
    });
  });

  // ── finished phase ────────────────────────────────────────────────────────
  describe('finished phase', () => {
    function buildFinishedContext(loser: string, sessionId: string) {
      const players = new MapSchema<Player>();
      players.set('p1', makePlayer('p1', { username: 'Alice' }));
      players.set('p2', makePlayer('p2', { username: 'Bob' }));

      const seatOrder = new ArraySchema<string>('p1', 'p2');
      const gs = makeGameState({ phase: 'finished', players, seatOrder, loser });
      const room = makeRoom(sessionId);
      return { gs, room };
    }

    it('shows "YOU ARE THE DURAK!" when the current player lost', () => {
      const { gs, room } = buildFinishedContext('p1', 'p1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText(/you are the durak/i)).toBeInTheDocument();
    });

    it('shows "YOU SURVIVED!" when the current player won', () => {
      const { gs, room } = buildFinishedContext('p2', 'p1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText(/you survived/i)).toBeInTheDocument();
    });

    it('shows "DRAW!" when loser is null (or empty)', () => {
      // GameState.loser is a string — empty string maps to the draw branch
      const { gs, room } = buildFinishedContext('', 'p1');
      // Explicitly set to null to hit the null branch
      (gs as unknown as { loser: null }).loser = null;
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByText(/draw/i)).toBeInTheDocument();
    });

    it('shows a "Play Again" button', () => {
      const { gs, room } = buildFinishedContext('p2', 'p1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument();
    });

    it('sends startGame when "Play Again" is clicked', async () => {
      const user = userEvent.setup();
      const { gs, room } = buildFinishedContext('p2', 'p1');
      mockGameContext({ room: room as never, gameState: gs });
      render(<GameBoard />);
      await user.click(screen.getByRole('button', { name: /play again/i }));
      expect(room.send).toHaveBeenCalledWith('startGame');
    });
  });

  // ── game message toast ─────────────────────────────────────────────────────
  describe('game message toast', () => {
    it('shows an error toast when gameMessage is set', () => {
      const players = new MapSchema<Player>();
      players.set('p1', makePlayer('p1'));
      const gs = makeGameState({
        phase: 'playing',
        players,
        seatOrder: new ArraySchema<string>('p1'),
      });
      const room = makeRoom('p1');

      mockGameContext({
        room: room as never,
        gameState: gs,
        gameMessage: 'Invalid move!',
      });
      render(<GameBoard />);
      expect(screen.getByText('Invalid move!')).toBeInTheDocument();
    });

    it('calls clearGameMessage when the toast dismiss button is clicked', () => {
      const players = new MapSchema<Player>();
      players.set('p1', makePlayer('p1'));
      const gs = makeGameState({
        phase: 'playing',
        players,
        seatOrder: new ArraySchema<string>('p1'),
      });
      const room = makeRoom('p1');
      const clearGameMessage = vi.fn();

      mockGameContext({
        room: room as never,
        gameState: gs,
        gameMessage: 'Invalid move!',
        clearGameMessage,
      });
      render(<GameBoard />);
      fireEvent.click(screen.getByRole('button', { name: '×' }));
      expect(clearGameMessage).toHaveBeenCalledOnce();
    });
  });
});
