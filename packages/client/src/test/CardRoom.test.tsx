import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Card, GameState, Player, SeatRequest } from '@durak/shared';
import { CardRoom } from '../room/CardRoom';
import { useGame } from '../contexts/GameContext';

vi.mock('../contexts/GameContext', () => ({ useGame: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../contexts/CardBackContext', () => ({ useCardBack: () => ({ imageUrl: null }) }));
vi.mock('../components/three/ThreeTable', () => ({
  default: ({
    defensePairs,
  }: {
    defensePairs?: readonly { attack: { key: string }; defense: { key: string } }[];
  }) => (
    <div
      data-testid="spatial-table"
      data-preview={
        defensePairs?.map((pair) => `${pair.attack.key}>${pair.defense.key}`).join('|') || ''
      }
    >
      Spatial table
    </div>
  ),
}));
vi.mock('../components/three/GesturePreview', () => ({
  default: () => <div>Character mirror</div>,
}));

let state: GameState;
let send: ReturnType<typeof vi.fn>;
let create: ReturnType<typeof vi.fn>;
let value: ReturnType<typeof useGame>;
beforeEach(() => {
  localStorage.clear();
  state = new GameState();
  state.phase = 'playing';
  state.currentTurn = 'me';
  state.turnStartTime = 10;
  state.huzurSuit = 'Spades';
  state.deckCount = 10;
  const me = new Player('me');
  const other = new Player('other');
  me.hand.push(new Card('Hearts', 7), new Card('Spades', 16));
  state.players.set('me', me);
  state.players.set('other', other);
  state.seatOrder.push('me', 'other');
  send = vi.fn();
  create = vi.fn().mockResolvedValue(undefined);
  value = {
    room: { roomId: 'CaseSensitive123', sessionId: 'me', send },
    gameState: state,
    isConnected: true,
    isSpectator: false,
    isReconnecting: false,
    serverTimeOffset: 0,
    createGame: create,
    clearGameMessage: vi.fn(),
    clearGameAbortReason: vi.fn(),
  } as unknown as ReturnType<typeof useGame>;
  vi.mocked(useGame).mockImplementation(() => value);
});

describe('manual public gestures', () => {
  it('sends only a named gesture and leaves the card selection alone', () => {
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Gestures' }));
    fireEvent.click(screen.getByRole('button', { name: 'Touch nose' }));
    expect(send).toHaveBeenCalledWith('gesture', { id: 'nose' });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('disables gesture controls for spectators and during the cooldown, while announcing peers', () => {
    const other = state.players.get('other')!;
    other.username = 'Ana';
    other.gestureId = 'two';
    other.gestureStartedAt = Date.now() - 500;
    state.players.get('me')!.gestureStartedAt = Date.now() - 500;
    const { rerender } = render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Gestures' }));
    expect(screen.getByRole('button', { name: 'Four fingers' })).toBeDisabled();
    expect(screen.getByText('Ana: Two fingers')).toBeVisible();
    state.players.get('me')!.gestureStartedAt = 0;
    value.isSpectator = true;
    rerender(<CardRoom authError="" />);
    expect(screen.getByRole('button', { name: 'Four fingers' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close gestures' }), { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Public gestures' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Gestures' })).toHaveFocus();
  });
});

describe('private table lifecycle', () => {
  it('replaces rematch voting with Ready for next game and shows the countdown', () => {
    state.isPrivate = true;
    state.maxPlayers = 2;
    state.phase = 'finished';
    state.outcome = 'win';
    state.winners.push('me');
    const { rerender } = render(<CardRoom authError="" />);
    expect(screen.queryByRole('button', { name: /Rematch/ })).toBeNull();
    expect(screen.getByText('0/2 ready')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Ready for next game/ }));
    expect(send).toHaveBeenCalledWith('toggleReady', { isReady: true });

    state.players.get('me')!.isReady = true;
    state.phase = 'countdown';
    state.phaseEndsAt = Date.now() + 2500;
    rerender(<CardRoom authError="" />);
    // Results stay visible through a countdown that started from them.
    expect(screen.getByRole('heading', { name: 'You won.' })).toBeVisible();
    expect(screen.getByText(/Dealing in [23]…/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Not ready/ }));
    expect(send).toHaveBeenCalledWith('toggleReady', { isReady: false });
  });

  it('shows the opening without play controls or a running turn clock', () => {
    state.isPrivate = true;
    state.phase = 'opening';
    state.turnStartTime = 0;
    state.phaseEndsAt = Date.now() + 3500;
    state.huzurCard = new Card('Spades', 9);
    state.players.get('other')!.username = 'Ana';
    state.currentTurn = 'other';
    render(<CardRoom authError="" />);
    expect(screen.getByRole('heading', { name: 'Dealing the cards.' })).toBeVisible();
    expect(screen.getByText(/Ana leads\./)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Play cards|Defend/ })).toBeNull();
    expect(screen.getByLabelText(/Play begins in [34] seconds/)).toBeVisible();
  });
});

describe('temporary bot control', () => {
  it('keeps the result after a departed winner’s seat is released', () => {
    state.isPrivate = true;
    state.maxPlayers = 2;
    state.phase = 'finished';
    state.outcome = 'win';
    state.winners.push('gone');
    state.winnerName = 'Ana';
    render(<CardRoom authError="" />);
    expect(screen.getByRole('heading', { name: 'Ana wins.' })).toBeVisible();
    expect(
      screen.getByText('Ana was first out of cards. There’s always another round.'),
    ).toBeVisible();
  });

  it('explains that leaving a private game hands the seat to a bot', () => {
    // jsdom has no modal dialog support.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
    state.isPrivate = true;
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Leave table' })[0]!);
    expect(screen.getByText(/A bot plays your seat for the rest of this game/)).toBeVisible();
  });
});

describe('invitation preview and seat requests', () => {
  it('lets an invited watcher see the table and take an open seat', () => {
    state.isPrivate = true;
    state.phase = 'waiting';
    state.maxPlayers = 3;
    state.players.delete('me');
    state.players.get('other')!.username = 'Host';
    value.isSpectator = true;
    localStorage.setItem('durak_display_name', 'Mika');
    render(<CardRoom authError="" />);
    expect(screen.getByRole('heading', { name: 'Watching a table' })).toBeVisible();
    expect(screen.getByText('Host')).toBeVisible();
    expect(screen.getByText('2 seats are open.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Join the table/ }));
    expect(send).toHaveBeenCalledWith('requestSeat', { username: 'Mika', avatarPreset: 'copper' });
    // Watchers have no readiness or hosting controls.
    expect(screen.queryByRole('button', { name: /Ready to play/ })).toBeNull();
  });

  it('reports a late arrival’s place in line while the game is in progress', () => {
    state.isPrivate = true;
    state.maxPlayers = 2;
    state.players.set('me2', new Player('me2'));
    state.players.delete('me');
    state.seatRequests.push(new SeatRequest('someone', 'Ana'), new SeatRequest('me', 'Mika'));
    value.isSpectator = true;
    render(<CardRoom authError="" />);
    expect(screen.getByText('You’re #2 in line.')).toBeVisible();
    expect(screen.getByText(/The table is full/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the line' }));
    expect(send).toHaveBeenCalledWith('cancelSeatRequest');
  });
});

describe('replacement card room play flow', () => {
  it('groups a manual 2v2 lobby into teams and sends an explicit team choice', () => {
    state.mode = 'teams';
    state.teamSelection = 'manual';
    state.maxPlayers = 4;
    state.isPrivate = true;
    state.phase = 'waiting';
    state.players.get('me')!.team = 0;
    state.players.get('other')!.team = 1;
    state.players.get('other')!.username = 'Ana';
    render(<CardRoom authError="" />);
    const board = within(screen.getByRole('region', { name: 'Teams' }));
    expect(board.getByText('Blue')).toBeVisible();
    expect(board.getByText('Red')).toBeVisible();
    expect(board.getByText('Ana')).toBeVisible();
    expect(board.getAllByText('Open seat')).toHaveLength(2);
    fireEvent.click(board.getByRole('button', { name: 'Join Red' }));
    expect(send).toHaveBeenCalledWith('switchTeam', { team: 1 });
  });

  it('shows a full team without offering an invalid switch', () => {
    state.mode = 'teams';
    state.teamSelection = 'manual';
    state.maxPlayers = 4;
    state.isPrivate = true;
    state.phase = 'waiting';
    state.players.get('me')!.team = 0;
    state.players.get('other')!.team = 1;
    const fourth = new Player('fourth');
    fourth.team = 1;
    state.players.set('fourth', fourth);
    render(<CardRoom authError="" />);
    expect(screen.getByRole('button', { name: 'Team full' })).toBeDisabled();
  });

  it('shows who is playing for each team during a match', () => {
    state.mode = 'teams';
    state.maxPlayers = 4;
    state.players.get('me')!.team = 0;
    state.players.get('other')!.team = 1;
    state.players.get('other')!.username = 'Ana';
    state.currentTurn = 'other';
    render(<CardRoom authError="" />);
    const board = within(screen.getByRole('region', { name: 'Teams' }));
    expect(board.getByText('Ana')).toBeVisible();
    expect(board.getByText('Playing')).toBeVisible();
    expect(screen.getByText('Red team is playing. Stay ready.')).toBeVisible();
  });

  it('lets the team result replace a conflicting generic game-over toast', () => {
    state.mode = 'teams';
    state.phase = 'finished';
    state.outcome = 'win';
    state.winners.push('me');
    state.winnerTeam = 0;
    state.players.get('me')!.team = 0;
    value.gameMessage = 'Game over. Another player went out first.';
    render(<CardRoom authError="" />);
    expect(screen.getByRole('heading', { name: 'Your team won this game.' })).toBeVisible();
    expect(screen.queryByText(value.gameMessage)).toBeNull();
  });
  it('reports a team loss to the losing team and a neutral result to spectators', () => {
    state.mode = 'teams';
    state.phase = 'finished';
    state.outcome = 'win';
    state.winners.push('x');
    state.winnerTeam = 0;
    state.players.get('me')!.team = 1;
    state.players.get('other')!.team = 1;
    const { rerender } = render(<CardRoom authError="" />);
    expect(screen.getByRole('heading', { name: 'Your team lost this game.' })).toBeVisible();
    value.isSpectator = true;
    rerender(<CardRoom authError="" />);
    expect(screen.getByRole('heading', { name: 'Blue team wins.' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Rematch/ })).toBeNull();
  });
  it('shows Horse progression without a sub-game rematch, then shows the final match winner', () => {
    state.mode = 'horse';
    state.phase = 'finished';
    state.outcome = 'win';
    state.winners.push('me');
    state.winnerTeam = 0;
    state.players.get('me')!.team = 0;
    state.players.get('other')!.team = 1;
    state.horseTeamB = 'H';
    state.horseGame = 2;
    const { rerender } = render(<CardRoom authError="" />);
    expect(screen.getByText(/Returning to the lobby/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Rematch/ })).toBeNull();
    state.horseTeamB = 'HORSE';
    rerender(<CardRoom authError="" />);
    expect(screen.getByRole('heading', { name: 'Your team won the match.' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Play another Horse match/ })).toBeVisible();
  });
  it.each([false, true])(
    'keeps the public Huzur visible and current (spectator: %s)',
    (spectator) => {
      value.isSpectator = spectator;
      state.huzurCard = new Card('Hearts', 13);
      const { rerender } = render(<CardRoom authError="" />);
      const reference = within(screen.getByLabelText('Huzur card'));
      expect(reference.getByRole('img', { name: 'King of Hearts' })).toBeVisible();
      expect(reference.getByText('Ground card')).toBeVisible();
      state.huzurCard.rank = 7;
      rerender(<CardRoom authError="" />);
      expect(reference.getByRole('img', { name: '7 of Hearts' })).toBeVisible();
      expect(reference.queryByRole('img', { name: 'King of Hearts' })).toBeNull();
      state.deckCount = 0;
      rerender(<CardRoom authError="" />);
      expect(reference.getByRole('img', { name: '7 of Hearts' })).toBeVisible();
      expect(reference.getByText('Trump reference')).toBeVisible();
      expect(reference.getByText('Deck empty')).toBeVisible();
    },
  );
  it('keeps all seven attack cards readable beside the play controls', () => {
    for (let rank = 7; rank <= 13; rank++) state.activeAttackCards.push(new Card('Clubs', rank));
    render(<CardRoom authError="" />);
    expect(
      screen.getByLabelText('Active table cards').querySelectorAll('[role="img"]'),
    ).toHaveLength(7);
    expect(screen.getByRole('img', { name: 'King of Clubs' })).toBeVisible();
    expect(screen.getByText('To beat')).toBeVisible();
  });
  it.each([
    ['2v2', 4],
    ['3v3', 6],
  ] as const)('creates the %s format with supported team seats', async (format, seats) => {
    value.isConnected = false;
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('tab', { name: 'With friends' }));
    fireEvent.click(screen.getByRole('button', { name: format }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create a table' }));
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'teams', maxPlayers: seats }),
    );
  });
  it('persists a selected character and submits lobby appearance changes', () => {
    state.phase = 'waiting';
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Sage avatar' }));
    expect(localStorage.getItem('durak_avatar')).toBe('sage');
    expect(send).toHaveBeenCalledWith('avatarPreset', { preset: 'sage' });
  });
  it('keeps accumulated table cards and Huzur visible in the 2D fallback', () => {
    state.huzurCard = new Card('Clubs', 8);
    state.tableStacks.push(new Card('Diamonds', 12));
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: '2D view' }));
    expect(screen.getByRole('img', { name: '8 of Clubs' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Queen of Diamonds' })).toBeVisible();
    expect(screen.getByText('On the table · 1')).toBeVisible();
  });
  it('starts a real practice room from the new home dock', async () => {
    value.isConnected = false;
    render(<CardRoom authError="" />);
    await screen.findByText('Spatial table');
    fireEvent.change(screen.getByLabelText('Your table name'), { target: { value: 'Mika' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }));
    fireEvent.click(screen.getByRole('button', { name: /^Hard/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Practice against a bot' }));
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'Mika',
        handSize: 5,
        botDifficulty: 'hard',
        maxPlayers: 2,
      }),
    );
  });
  it('keeps supported teams settings when creating a private room', async () => {
    value.isConnected = false;
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('tab', { name: 'With friends' }));
    fireEvent.change(screen.getByLabelText('Seats', { exact: true }), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Game', { exact: true }), {
      target: { value: 'horse' },
    });
    fireEvent.change(screen.getByLabelText('Hand', { exact: true }), { target: { value: '7' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create a table' }));
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'horse', maxPlayers: 4, handSize: 7, isPrivate: true }),
    );
  });
  it('submits selected cards only after explicit confirmation', () => {
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 7 of Hearts' }));
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Play cards/ }));
    expect(send).toHaveBeenCalledWith('attack', {
      cards: [expect.objectContaining({ suit: 'Hearts', rank: 7 })],
    });
  });
  it('explains an impossible defense beside the action before anything is sent', () => {
    state.activeAttackCards.push(new Card('Hearts', 13));
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 7 of Hearts' }));
    expect(screen.getByText(/Each card must beat one attacking card/)).toBeVisible();
    expect(screen.getByRole('button', { name: /^Defend/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Defend/ }));
    expect(send).not.toHaveBeenCalled();
  });
  it('previews the one-to-one defense assignment from shared validation', () => {
    state.activeAttackCards.push(new Card('Hearts', 13));
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Ace of Spades' }));
    expect(screen.getByText('Ace of Spades beats King of Hearts')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /^Defend/ }));
    expect(send).toHaveBeenCalledWith('defend', {
      cards: [expect.objectContaining({ suit: 'Spades', rank: 16 })],
    });
  });
  it('shows each proposed defense beside its attack and clears the table preview when selection changes', async () => {
    state.players.get('me')!.hand.push(new Card('Clubs', 8));
    state.activeAttackCards.push(new Card('Hearts', 13), new Card('Clubs', 7));
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Ace of Spades' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 8 of Clubs' }));
    const pairs = within(screen.getByLabelText('Active table cards'));
    expect(pairs.getByLabelText('Ace of Spades beats King of Hearts')).toBeVisible();
    expect(pairs.getByLabelText('8 of Clubs beats 7 of Clubs')).toBeVisible();
    expect((await screen.findByTestId('spatial-table')).getAttribute('data-preview')).toContain(
      'Hearts:13:0>Spades:16:0',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select 8 of Clubs' }));
    expect(screen.getByTestId('spatial-table')).toHaveAttribute('data-preview', '');
    expect(pairs.queryByLabelText('8 of Clubs beats 7 of Clubs')).toBeNull();
  });
  it('explains an illegal mass attack before submission', () => {
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 7 of Hearts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Ace of Spades' }));
    expect(screen.getByText('Play one card, or a mass attack of 3, 5 or 7 cards.')).toBeVisible();
    expect(screen.getByRole('button', { name: /^Play cards/ })).toBeDisabled();
  });
  it('blocks duplicate confirmation and keeps the selection when the server rejects it', () => {
    const { rerender } = render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 7 of Hearts' }));
    fireEvent.click(screen.getByRole('button', { name: /^Play cards/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Play cards/ }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sending to the table…')).toBeVisible();
    value = { ...value, error: 'You can only attack with a rank that is already on the table.' };
    rerender(<CardRoom authError="" />);
    expect(screen.getByRole('button', { name: 'Select 7 of Hearts' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Play cards/ })).toBeEnabled();
  });
  it('invalidates selection when a new turn starts despite schema mutation in place', () => {
    const { rerender } = render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 7 of Hearts' }));
    state.turnStartTime = 20;
    rerender(<CardRoom authError="" />);
    expect(screen.getByRole('button', { name: 'Play cards' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select 7 of Hearts' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
  it('offers the custom Ace of Spades swap for a Joker Huzur', () => {
    state.huzurCard = new Card('None', 18, true);
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Swap Huzur' }));
    expect(send).toHaveBeenCalledWith('swapHuzur');
  });
  it('does not offer a swap using a picked-up Ace of Spades', () => {
    state.huzurCard = new Card('None', 18, true);
    state.players.get('me')!.pickedUpCardKeys.push('Spades:16:0');
    render(<CardRoom authError="" />);
    expect(screen.queryByRole('button', { name: 'Swap Huzur' })).not.toBeInTheDocument();
  });
  it('keeps spectator card controls empty and prevents playing', () => {
    value.isSpectator = true;
    render(<CardRoom authError="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Card controls' }));
    expect(screen.queryByRole('button', { name: /^Select / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play cards' })).not.toBeInTheDocument();
  });
});
