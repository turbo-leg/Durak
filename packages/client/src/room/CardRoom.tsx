import { lazy, Suspense, useEffect, useState } from 'react';
import { Card, AVATAR_PRESETS, avatarPreset, type PublicGesture } from '@durak/shared';
import { GesturePicker } from './GesturePicker';
import { AvatarPicker } from './AvatarPicker';
import { SeatRequest } from './SeatRequest';
import { Face } from './CardFace';
import { SUITS } from '../game/cardGlyphs';
import { describePairs, previewPlay } from '../game/playPreview';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { useCardBack } from '../contexts/CardBackContext';
import {
  cardLabel,
  seatStatus,
  tableCards,
  tableSnapshot,
  type TableCard,
  type TableSnapshot,
} from '../game/tableSnapshot';
import { RoomLobby, RoomMenu } from './RoomMenu';
import { AccountPanel, RoomDialog, RulesPanel } from './RoomDialog';
import './card-room.css';

const ThreeTable = lazy(() => import('../components/three/ThreeTable'));
const demoCard = (suit: string, rank: number): TableCard => ({
  suit,
  rank,
  isJoker: rank > 16,
  key: `${suit}:${rank}:${rank > 16 ? 1 : 0}`,
});
const demo: TableSnapshot = {
  signature: 'welcome',
  canSelect: true,
  hand: [
    demoCard('Spades', 16),
    demoCard('Hearts', 13),
    demoCard('Clubs', 14),
    demoCard('Diamonds', 11),
    demoCard('None', 18),
  ],
  attacks: [],
  history: [],
  huzur: demoCard('Hearts', 7),
  deckCount: 32,
  discardCount: 0,
  seats: Array.from({ length: 5 }, (_, i) => ({
    id: `welcome:${i}`,
    name: ['Sage', 'Indigo', 'Ochre', 'Copper', 'Sage'][i]!,
    preset: AVATAR_PRESETS[(i + 1) % 4]!.id,
    count: 5,
    active: i === 2,
    escaped: false,
  })),
};

export function CardRoom({
  embeddedName,
  authError,
}: {
  embeddedName?: string;
  authError: string;
}) {
  const game = useGame();
  const auth = useAuth();
  const { imageUrl } = useCardBack();
  const [modal, setModal] = useState<'rules' | 'account' | 'leave' | null>(null);
  const [fallback, setFallback] = useState(false);
  const [preset, setPreset] = useState(
    () => avatarPreset(localStorage.getItem('durak_avatar')).id as string,
  );
  const [recenterKey, setRecenterKey] = useState(0);
  const [keyboard, setKeyboard] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 760px)').matches,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState(() => localStorage.getItem('durak_display_name') || '');
  const [notice, setNotice] = useState('');
  const [dismissed, setDismissed] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [demoGesture, setDemoGesture] = useState<PublicGesture>({});
  const state = game.gameState;
  const live = Boolean(game.isConnected && state && game.room);
  const phase = live ? state!.phase : 'home';
  const session = game.room?.sessionId || '';
  const me = state?.players.get(session);
  const horse = state?.mode === 'horse';
  const horseMatchOver = horse && (state!.horseTeamA.length >= 5 || state!.horseTeamB.length >= 5);
  const teamMode = state?.mode === 'teams' || horse;
  // The first player out wins; in Teams and Horse their whole team wins. A departed
  // winner's seat is released at game end, so the result keeps their name and team.
  const draw = state?.outcome === 'draw';
  const won = Boolean(state && state.winners.includes(session));
  const lost = Boolean(state?.outcome === 'win' && me && !won);
  const winnerName = state?.winnerName || 'A player';
  const winnerTeamName = state?.winnerTeam === 0 ? 'Blue' : 'Red';
  const resultTitle = draw
    ? 'An even table.'
    : game.isSpectator || !me
      ? teamMode
        ? `${winnerTeamName} team wins${horseMatchOver ? ' the match' : ''}.`
        : `${winnerName} wins.`
      : horseMatchOver
        ? won
          ? 'Your team won the match.'
          : 'Your team lost the match.'
        : teamMode
          ? won
            ? 'Your team won this game.'
            : 'Your team lost this game.'
          : won
            ? 'You won.'
            : `${winnerName} wins.`;
  const resultLine = draw
    ? 'Call it a draw. Another round?'
    : teamMode
      ? `${winnerName} went out first for the ${winnerTeamName} team.`
      : won
        ? 'You were first out of cards. Another round?'
        : `${winnerName} was first out of cards. There’s always another round.`;
  const playing = phase === 'playing';
  const opening = phase === 'opening';
  // A countdown from the results screen keeps the results visible until the deal.
  const showResult =
    phase === 'finished' || (phase === 'countdown' && Boolean(state?.winners.length));
  const privateTable = Boolean(state?.isPrivate);
  const humans = state
    ? Array.from(state.players.values()).filter((p) => p.control === 'human')
    : [];
  const readyHumans = humans.filter((p) => p.isReady).length;
  // Horse on private tables advances the game number at the next deal.
  const horseGameShown =
    privateTable || horseMatchOver ? state?.horseGame : (state?.horseGame ?? 1) - 1;
  const view = live
    ? tableSnapshot(state!, session, game.isSpectator, game.serverTimeOffset)
    : {
        ...demo,
        self: { preset, played: 0, ...demoGesture },
        signature: `welcome:${preset}:${demoGesture.gestureStartedAt}`,
      };
  const chooseAvatar = (value: string) => {
    setPreset(value);
    localStorage.setItem('durak_avatar', value);
    if (live && phase === 'waiting' && !game.isSpectator)
      game.room?.send('avatarPreset', { preset: value });
  };
  const avatarPicker = (
    <AvatarPicker value={live ? me?.avatarPreset || preset : preset} change={chooseAvatar} />
  );
  const turnKey = `${game.room?.roomId || 'demo'}:${state?.phase}:${state?.currentTurn}:${state?.turnStartTime}`;
  const [selectionTurn, setSelectionTurn] = useState(turnKey);
  const selectedKeys =
    selectionTurn === turnKey ? selected.filter((key) => view.hand.some((c) => c.key === key)) : [];
  const picked = view.hand.filter((c) => selectedKeys.includes(c.key));
  const seconds = Math.max(
    0,
    Math.ceil(
      ((state?.turnStartTime || 0) +
        (state?.turnTimeLimit || 30000) -
        now -
        game.serverTimeOffset) /
        1000,
    ),
  );
  const phaseSeconds = Math.max(
    0,
    Math.ceil(((state?.phaseEndsAt || 0) - now - game.serverTimeOffset) / 1000),
  );
  const playerName =
    embeddedName || auth.user?.globalName || auth.user?.username || name.trim() || 'Guest';
  const seatRequest = <SeatRequest playerName={playerName} preset={preset} />;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    localStorage.setItem('durak_display_name', name);
  }, [name]);
  const toggle = (key: string) => {
    if (!view.canSelect) return;
    setSelectionTurn(turnKey);
    setSelected((old) => {
      const active = selectionTurn === turnKey ? old : [];
      return active.includes(key) ? active.filter((k) => k !== key) : [...active, key];
    });
  };
  // Select → preview → confirm. The preview uses the shared rules the server applies.
  const preview = live
    ? previewPlay(picked, {
        attacks: view.attacks,
        table: tableCards(state!),
        huzurSuit: state!.huzurSuit,
        handCounts: Array.from(state!.players.values()).map((p) => p.handCount),
        deckCount: state!.deckCount,
        targetHandSize: state!.targetHandSize,
      })
    : null;
  // A confirmed play waits for the server: no duplicate sends, and the selection
  // stays recoverable if it is rejected. Acceptance changes the turn.
  // A new server error after sending (rejection) or a turn change (acceptance) ends the wait.
  const [sent, setSent] = useState<{ turn: string; error: string | null } | null>(null);
  const awaiting = sent?.turn === turnKey && sent.error === (game.error ?? null);
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(null), 4000);
    return () => clearTimeout(timer);
  }, [sent]);
  const play = () => {
    if (!view.canSelect || !picked.length || !game.room || awaiting || !preview?.legal) return;
    const cards = picked.map((c) => new Card(c.suit, c.rank, c.isJoker));
    setNotice('');
    setSent({ turn: turnKey, error: game.error ?? null });
    game.room.send(view.attacks.length ? 'defend' : 'attack', { cards });
  };
  const turnName = state?.players.get(state.currentTurn)?.username || 'Your opponent';
  // The server decides eligibility; this button appears only when a candidate exists.
  const canSwap =
    playing &&
    !game.isSpectator &&
    view.deckCount > 0 &&
    Boolean(
      me?.hand.some(
        (c) =>
          c &&
          !c.isJoker &&
          (state?.huzurCard.isJoker
            ? c.rank === 16 && c.suit === 'Spades'
            : c.rank === 7 && c.suit === state?.huzurSuit) &&
          !me.pickedUpCardKeys.includes(`${c.suit}:${c.rank}:0`),
      ),
    );
  const info = notice || game.error || authError || game.gameMessage || game.gameAbortReason;

  return (
    <main className={`card-room ${live ? 'in-game' : 'at-home'} ${fallback ? 'flat-view' : ''}`}>
      <header className="room-header">
        <a
          className="wordmark"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            if (live) setModal('leave');
          }}
          aria-label="Durak home"
        >
          <span className="brand-suit">♠</span>durak
          <span className="brand-caption">The card room</span>
        </a>
        <nav aria-label="Main navigation">
          <button className="quiet-button" onClick={() => setModal('rules')}>
            How to play
          </button>
          <button
            className="account-button"
            aria-label="Account"
            onClick={() => setModal('account')}
          >
            <span className="avatar">{playerName.slice(0, 1).toUpperCase()}</span>
            <span>{auth.user ? playerName : 'Guest player'}</span>
          </button>
          {live && (
            <button className="quiet-button" onClick={() => setModal('leave')}>
              Leave table
            </button>
          )}
        </nav>
      </header>

      <div className="room-stage">
        <div className="scene-atmosphere" />
        <div className="scene" aria-label="Interactive card table">
          {!fallback ? (
            <Suspense fallback={<div className="scene-loading">Setting the table…</div>}>
              <ThreeTable
                key={live ? `${game.room!.roomId}:${game.isSpectator}` : 'welcome'}
                snapshot={view}
                selectedKeys={selectedKeys.join('|')}
                backUrl={imageUrl}
                onSelect={toggle}
                onLook={(yaw, pitch) => {
                  if (live && !game.isSpectator) game.room?.send('look', { yaw, pitch });
                }}
                recenterKey={recenterKey}
                onUnavailable={() => {
                  setFallback(true);
                  setNotice(
                    'The 3D view is unavailable. You can keep playing with the card controls.',
                  );
                  setDismissed('');
                }}
              />
            </Suspense>
          ) : (
            <div className="flat-table">
              <div className="flat-seats">
                {view.seats.map((seat) => (
                  <span key={seat.id}>
                    {seat.name}
                    <small>{seatStatus(seat, view.betweenGames)}</small>
                  </span>
                ))}
                {Array.from(
                  {
                    length: Math.max(
                      0,
                      (view.capacity ?? 0) - view.seats.length - (game.isSpectator ? 0 : 1),
                    ),
                  },
                  (_, i) => (
                    <span key={`empty-${i}`} className="empty-seat">
                      Empty seat
                    </span>
                  ),
                )}
              </div>
              <div className="flat-piles">
                <span>
                  Deck
                  <br />
                  <strong>{view.deckCount}</strong>
                </span>
                {view.attacks.map((c) => (
                  <Face key={c.key} card={c} />
                ))}
                <span>
                  Discarded
                  <br />
                  <strong>{view.discardCount}</strong>
                </span>
              </div>
              {view.history.length > 0 && (
                <div className="flat-history" aria-label="Cards accumulated on the table">
                  <span>On the table · {view.history.length}</span>
                  <div>
                    {view.history.map((c, i) => (
                      <Face key={`${i}:${c.key}`} card={c} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {(playing || opening || phase === 'finished') && (
            <aside className="huzur-reference" aria-label="Huzur card" aria-live="polite">
              <Face card={view.huzur} />
              <div>
                <strong>{view.deckCount > 0 ? 'Huzur' : 'Trump reference'}</strong>
                <span>{cardLabel(view.huzur)}</span>
                <small>{view.deckCount > 0 ? 'Ground card' : 'Deck empty'}</small>
              </div>
            </aside>
          )}
        </div>
        {!live && (
          <section className="welcome-copy">
            <p className="room-kicker">Your friends. Your table.</p>
            <h1>Take your seat.</h1>
          </section>
        )}
        {playing && (
          <section
            className={`turn-banner ${view.canSelect ? 'your-turn' : ''}`}
            aria-live="polite"
          >
            <span className="status-dot" />
            <div>
              <h1>
                {game.isSpectator
                  ? 'Watching the table'
                  : view.canSelect
                    ? view.attacks.length
                      ? 'Your defense.'
                      : 'Your move.'
                    : `${turnName}’s turn`}
              </h1>
              <p>
                {view.canSelect
                  ? view.attacks.length
                    ? `Beat ${view.attacks.length === 1 ? 'the card' : `all ${view.attacks.length} cards`} or pick up the table.`
                    : 'Select your cards, then send them to the table.'
                  : 'The table moves clockwise. Stay ready.'}
              </p>
            </div>
            <span
              className={`turn-clock ${seconds <= 5 ? 'urgent' : ''}`}
              aria-live="off"
              aria-label={`${seconds} seconds remaining`}
            >
              {seconds}
              <small>sec</small>
            </span>
          </section>
        )}
        {opening && (
          <section className="turn-banner opening-banner" aria-live="polite">
            <span className="status-dot" />
            <div>
              <h1>Dealing the cards.</h1>
              <p>
                Huzur: {cardLabel(view.huzur)}.{' '}
                {Array.from(state!.openingDraws)
                  .filter((draw) => !!draw)
                  .map(
                    (draw) =>
                      `${state!.players.get(draw.playerId)?.username || 'A player'} drew ${cardLabel(draw.card)}`,
                  )
                  .join(' · ')}
                {state!.openingDraws.length > 0 ? '. ' : ''}
                {state!.currentTurn === session ? 'You lead.' : `${turnName} leads.`}
              </p>
            </div>
            <span className="turn-clock" aria-label={`Play begins in ${phaseSeconds} seconds`}>
              {phaseSeconds}
              <small>sec</small>
            </span>
          </section>
        )}
        {live && (
          <aside className="table-meta">
            <span className="connection-led" />
            {game.isSpectator && (
              <>
                Watching
                <span className="meta-divider" />
              </>
            )}
            {state!.mode === 'horse'
              ? `Horse · Game ${showResult ? horseGameShown : state!.horseGame}`
              : state!.mode === 'teams'
                ? `${state!.maxPlayers / 2}v${state!.maxPlayers / 2}`
                : state!.maxPlayers === 2
                  ? '1v1'
                  : `${state!.maxPlayers}-player free-for-all`}
            <span className="meta-divider" />
            {state!.targetHandSize}-card hands
            {(playing || opening) && (
              <>
                <span className="meta-divider" />
                <span aria-label={`Trump suit: ${state!.huzurSuit}`}>
                  Trump {SUITS[state!.huzurSuit]}
                </span>
              </>
            )}
            {state!.mode === 'horse' && (
              <span>
                Blue: {state!.horseTeamA || '—'} / Red: {state!.horseTeamB || '—'}
              </span>
            )}
          </aside>
        )}
        {!live && (
          <RoomMenu
            playerName={playerName}
            name={name}
            setName={setName}
            signedIn={Boolean(auth.user || embeddedName)}
            avatarPicker={avatarPicker}
          />
        )}
        {(phase === 'waiting' || (phase === 'countdown' && !showResult)) && (
          <RoomLobby
            countdownSeconds={phaseSeconds}
            seatRequest={seatRequest}
            avatarPicker={game.isSpectator ? undefined : avatarPicker}
            onNotice={(message) => {
              setNotice(message);
              setDismissed('');
            }}
          />
        )}
        {showResult && (
          <section className="result-dock play-dock" aria-label="Game result">
            <span className="result-suit" aria-hidden="true">
              {lost ? '♣' : '♠'}
            </span>
            <h2>{resultTitle}</h2>
            <p>{resultLine}</p>
            {horse && (
              <p>
                Game {horseGameShown} · Blue: {state!.horseTeamA || '—'} · Red:{' '}
                {state!.horseTeamB || '—'}
                {!horseMatchOver &&
                  (privateTable
                    ? ' · Ready up for the next game of the match.'
                    : ' · Returning to the lobby for the next game in a few seconds.')}
              </p>
            )}
            {game.eloResult && (
              <p className="rating-result">
                {game.eloResult.delta > 0 ? '+' : ''}
                {game.eloResult.delta} rating · {game.eloResult.newElo}
              </p>
            )}
            {privateTable && !game.isSpectator && me && (
              <>
                <button
                  className={me.isReady ? 'secondary-button' : 'primary-button'}
                  onClick={() => game.room?.send('toggleReady', { isReady: !me.isReady })}
                >
                  {me.isReady
                    ? 'Not ready'
                    : horseMatchOver
                      ? 'Ready for a new Horse match'
                      : 'Ready for next game'}
                  <span aria-hidden="true">↻</span>
                </button>
                <p role="status">
                  {phase === 'countdown'
                    ? `Dealing in ${phaseSeconds}…`
                    : `${readyHumans}/${humans.length} ready${
                        state!.players.size < state!.maxPlayers
                          ? ` · ${state!.maxPlayers - state!.players.size} empty ${state!.maxPlayers - state!.players.size === 1 ? 'seat' : 'seats'}`
                          : ''
                      }`}
                </p>
              </>
            )}
            {!privateTable && !game.isSpectator && (!horse || horseMatchOver) && (
              <button
                className="primary-button"
                disabled={Boolean(game.rematchState?.voters.includes(session))}
                onClick={() => game.sendRematchVote(true)}
              >
                {game.rematchState?.voters.includes(session)
                  ? 'Waiting for the table…'
                  : horse
                    ? 'Play another Horse match'
                    : 'Rematch'}
                <span aria-hidden="true">↻</span>
              </button>
            )}
            {!privateTable && game.rematchState && (
              <p>
                {game.rematchState.votes}/{game.rematchState.needed} ready for another round
              </p>
            )}
            {seatRequest}
            <button className="quiet-button full-width" onClick={game.leaveGame}>
              Back to the card room
            </button>
          </section>
        )}
        <div className="scene-caption">
          <span className="small-suits" aria-hidden="true">
            ♠ ♡
          </span>
          {playing
            ? `${view.deckCount} in deck / ${view.discardCount} discarded`
            : 'Click a card. Drag to look around.'}
        </div>
        <div className="view-tools">
          <GesturePicker
            self={view.self!}
            seats={view.seats}
            now={now}
            offset={live ? game.serverTimeOffset : 0}
            enabled={
              !live ||
              Boolean(me && !game.isSpectator && ['waiting', 'playing', 'finished'].includes(phase))
            }
            preview={!live}
            send={(id) => {
              if (live) game.room?.send('gesture', { id });
              else setDemoGesture({ gestureId: id, gestureStartedAt: Date.now() });
            }}
          />
          {!fallback && (
            <button className="quiet-button" onClick={() => setRecenterKey((value) => value + 1)}>
              Recenter
            </button>
          )}
          <button
            className="quiet-button"
            aria-pressed={fallback}
            onClick={() => {
              setFallback(!fallback);
              setNotice('');
            }}
          >
            {fallback ? 'Try 3D view' : '2D view'}
          </button>
          <button
            className="quiet-button"
            aria-pressed={keyboard}
            onClick={() => setKeyboard(!keyboard)}
          >
            {keyboard ? 'Hide card controls' : 'Card controls'}
          </button>
        </div>
      </div>
      {(keyboard || fallback) && phase !== 'waiting' && (
        <section className="card-controls">
          <div className="keyboard-hand" aria-label="Your hand">
            {view.hand.map((card) => (
              <button
                key={card.key}
                aria-label={`Select ${cardLabel(card)}`}
                aria-pressed={selectedKeys.includes(card.key)}
                disabled={!view.canSelect}
                className={selectedKeys.includes(card.key) ? 'hand-card selected' : 'hand-card'}
                onClick={() => toggle(card.key)}
              >
                <Face card={card} />
              </button>
            ))}
          </div>
        </section>
      )}
      {fallback && (
        <section className="sr-only" aria-label="Table state" aria-live="polite">
          <p>
            {view.deckCount} cards in the deck. {view.discardCount} discarded.
          </p>
          <ul aria-label="Incoming attack">
            {view.attacks.map((c) => (
              <li key={c.key}>{cardLabel(c)}</li>
            ))}
          </ul>
        </section>
      )}
      {(playing || opening) && game.isSpectator && privateTable && (
        <section className="action-dock" aria-label="Join this table">
          {seatRequest}
        </section>
      )}
      {playing && !game.isSpectator && (
        <section className="action-dock">
          {view.attacks.length > 0 && (
            <div className="attack-reference" aria-label="Active table cards">
              <div>
                <strong>{view.canSelect ? 'To beat' : 'On table'}</strong>
                <small>
                  {view.attacks.length} {view.attacks.length === 1 ? 'card' : 'cards'}
                </small>
              </div>
              <div
                className="attack-cards"
                style={{ gridTemplateColumns: `repeat(${view.attacks.length}, minmax(0, 42px))` }}
              >
                {view.attacks.map((card) => (
                  <Face key={card.key} card={card} />
                ))}
              </div>
            </div>
          )}
          <div className="action-copy">
            <strong>
              {view.canSelect
                ? picked.length
                  ? `${picked.length} ${picked.length === 1 ? 'card' : 'cards'} selected`
                  : view.attacks.length
                    ? 'Choose your defense.'
                    : 'Your hand, your move.'
                : state!.winners.includes(session)
                  ? 'You won.'
                  : 'Watch the table.'}
            </strong>
            <span role="status">
              {!view.canSelect
                ? 'Cards are played clockwise.'
                : awaiting
                  ? 'Sending to the table…'
                  : !preview
                    ? view.attacks.length
                      ? `Pick one card to beat each of the ${view.attacks.length === 1 ? 'attacking card' : `${view.attacks.length} attacking cards`}, or pick up.`
                      : 'Select cards, then confirm your play.'
                    : !preview.legal
                      ? preview.reason
                      : preview.kind === 'defense'
                        ? describePairs(preview)
                        : picked.length > 1
                          ? `Mass attack: ${picked.map(cardLabel).join(', ')}.`
                          : `Attack with ${cardLabel(picked[0]!)}.`}
            </span>
          </div>
          {picked.length > 0 && (
            <button className="quiet-button" onClick={() => setSelected([])}>
              Clear
            </button>
          )}
          {canSwap && (
            <button className="secondary-button" onClick={() => game.room?.send('swapHuzur')}>
              Swap Huzur
            </button>
          )}
          {view.canSelect && view.attacks.length > 0 && (
            <button
              className="secondary-button"
              onClick={() => {
                game.room?.send('pickUp');
                setSelected([]);
              }}
            >
              Pick up
            </button>
          )}
          <button
            className="primary-button play-button"
            disabled={!view.canSelect || !picked.length || awaiting || !preview?.legal}
            onClick={play}
          >
            {view.attacks.length ? 'Defend' : 'Play cards'}
            {picked.length > 0 && <span>{picked.length}</span>}
          </button>
        </section>
      )}
      {info && info !== dismissed && (
        <div className="room-notice" role="status">
          <span>{info}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setDismissed(info);
              setNotice('');
              game.clearGameMessage();
              game.clearGameAbortReason();
            }}
          >
            ×
          </button>
        </div>
      )}
      {(game.isReconnecting || game.connectionStatus === 'waiting_opponent') && (
        <div className="connection-overlay" role="status">
          <span className="connection-led" />
          {game.isReconnecting
            ? privateTable
              ? 'Reconnecting… If this takes more than a few seconds, a bot plays for you until you’re back.'
              : 'Finding your seat again…'
            : 'Waiting for your opponent to reconnect…'}
        </div>
      )}
      {modal === 'rules' && <RulesPanel close={() => setModal(null)} />}
      {modal === 'leave' && (
        <RoomDialog title="Leave this table?" close={() => setModal(null)}>
          <p>
            {(playing || opening) && privateTable && !game.isSpectator
              ? 'A bot plays your seat for the rest of this game, so your friends can finish. Your seat opens up when the game ends.'
              : playing && !game.isSpectator
                ? 'Your seat will be given up. The other players can keep going.'
                : 'You can join another table from the card room.'}
          </p>
          <div className="dialog-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Stay here
            </button>
            <button
              className="primary-button"
              onClick={() => {
                game.leaveGame();
                setModal(null);
              }}
            >
              Leave table
            </button>
          </div>
        </RoomDialog>
      )}
      {modal === 'account' && <AccountPanel playerName={playerName} close={() => setModal(null)} />}
    </main>
  );
}
