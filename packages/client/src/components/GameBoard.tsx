import React, { useState, useEffect, useRef } from 'react';
import { useGame, type RevealPair } from '../contexts/GameContext';
import { Card as UICard } from './Card';
import { Card as SharedCard, Player, type Tier } from '@durak/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAudio } from '../utils/audio';
import { useIsDesktop } from '../utils/useIsDesktop';
import { SuhuhReveal } from './SuhuhReveal';
import { PlayerProfilePanel } from './PlayerProfilePanel';
import { TierChangeOverlay } from './TierChangeOverlay';
import { EmoteWheel } from './EmoteWheel';

const DealSoundTrigger = ({ delayMs, playSound }: { delayMs: number; playSound: () => void }) => {
  React.useEffect(() => {
    const t = setTimeout(() => {
      playSound();
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, playSound]);
  return null;
};

export const GameBoard: React.FC = () => {
  const {
    room,
    gameState,
    gameMessage,
    clearGameMessage,
    suhuhResult,
    clearSuhuhResult,
    discardedCards,
    clearDiscardedCards,
    defenseRevealPairs,
    serverTimeOffset,
    updateLobbySettings,
    startLobbyGame,
    isSpectator,
    connectionStatus,
    disconnectedOpponent,
  } = useGame();
  const [selectedCards, setSelectedCards] = useState<SharedCard[]>([]);
  const [devSelectedCards, setDevSelectedCards] = useState<Record<string, SharedCard[]>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const {
    playDealSound,
    playCardSound,
    playPickupSound,
    playTimerWarning,
    playVictorySound,
    playDefeatSound,
    playDiscardSound,
  } = useAudio();
  const isDesktop = useIsDesktop();
  const warningPlayedRef = React.useRef(false);
  const gameResultKeyRef = React.useRef<string | null>(null);
  const [tierChange, setTierChange] = useState<{
    oldTier: Tier;
    newTier: Tier;
    direction: 'up' | 'down';
  } | null>(null);
  const [emoteToast, setEmoteToast] = useState<{ username: string; emoteId: string } | null>(null);

  // Update timer smoothly using requestAnimationFrame
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') {
      return;
    }

    let animationFrameId: number;

    const updateTimer = () => {
      // Adjusted clock: Add our measured server offset to local time
      const currentServerTime = Date.now() + serverTimeOffset;
      const elapsed = currentServerTime - gameState.turnStartTime;
      const remaining = Math.max(0, gameState.turnTimeLimit - elapsed);

      setTimeRemaining(remaining);

      // Loop for smooth progress bar
      animationFrameId = requestAnimationFrame(updateTimer);
    };

    updateTimer();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState?.phase, gameState?.turnStartTime, gameState?.turnTimeLimit, serverTimeOffset]);

  // Play discard sound when cards are marked for discard
  React.useEffect(() => {
    if (discardedCards && discardedCards.length > 0) playDiscardSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discardedCards]);

  // Clear the discard snapshot the moment a new attack is played
  React.useEffect(() => {
    if (discardedCards && gameState && gameState.activeAttackCards.length > 0) {
      clearDiscardedCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.activeAttackCards.length]);

  // Reset warning flag when the active turn changes
  React.useEffect(() => {
    warningPlayedRef.current = false;
  }, [gameState?.currentTurn]);

  // Timer warning sound — fires once per turn when < 5 s remain
  React.useEffect(() => {
    if (
      gameState?.currentTurn === room?.sessionId &&
      timeRemaining > 0 &&
      timeRemaining < 5000 &&
      !warningPlayedRef.current
    ) {
      warningPlayedRef.current = true;
      playTimerWarning();
    }
  }, [timeRemaining, gameState?.currentTurn, room?.sessionId, playTimerWarning]);

  // Victory / defeat jingle — fires once per game result
  React.useEffect(() => {
    if (!gameState || gameState.phase !== 'finished' || !room) return;
    const key = `${gameState.phase}:${gameState.loser}`;
    if (gameResultKeyRef.current === key) return;
    gameResultKeyRef.current = key;
    if (gameState.loser === room.sessionId) {
      playDefeatSound();
    } else {
      playVictorySound();
    }
  }, [gameState?.phase, gameState?.loser, room?.sessionId, playVictorySound, playDefeatSound]);

  useEffect(() => {
    if (!room) return;
    const handler = (data: {
      sessionId: string;
      oldTier: Tier;
      newTier: Tier;
      direction: 'up' | 'down';
    }) => {
      if (data.sessionId === room.sessionId) {
        setTierChange({ oldTier: data.oldTier, newTier: data.newTier, direction: data.direction });
      }
    };
    room.onMessage('tierChanged', handler);
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const handler = (data: { sessionId: string; username: string; emoteId: string }) => {
      setEmoteToast({ username: data.username, emoteId: data.emoteId });
      setTimeout(() => setEmoteToast(null), 2000);
    };
    room.onMessage('emote', handler);
  }, [room]);

  if (!room || !gameState) {
    return null;
  }

  const isMyTurn = gameState.currentTurn === room.sessionId;
  const myPlayer = gameState.players.get(room.sessionId);
  // True if viewing as a spectator — either the flag is set, or (once game is live) sessionId
  // is absent from seatOrder, which catches any render before the isSpectator state commits.
  const viewAsSpectator =
    isSpectator ||
    (gameState.seatOrder.length > 0 && !Array.from(gameState.seatOrder).includes(room.sessionId));
  const myHand = myPlayer
    ? Array.from(myPlayer.hand).filter((c): c is SharedCard => c !== undefined)
    : [];
  const tableCards = Array.from(gameState.tableStacks || []).filter(
    (c): c is SharedCard => c !== undefined,
  );

  // Server uses activeAttackCards to represent the current cards that must be beaten.
  // After a successful defend, the server also stores the defender's card(s) there.
  // To preserve gameplay clarity, we ALWAYS render activeAttackCards as "Incoming".
  const activeAttackCards = Array.from(gameState.activeAttackCards || []).filter(
    (c): c is SharedCard => c !== undefined,
  );
  const attackCards = activeAttackCards; // backward-compatible name used by controls

  const myTeamLabel = gameState.mode === 'teams' ? (myPlayer?.team === 0 ? 'BLUE' : 'RED') : '—';

  const myTeamBadge =
    gameState.mode === 'teams'
      ? myPlayer?.team === 0
        ? 'bg-blue-600/70 text-blue-100 ring-1 ring-blue-300'
        : 'bg-red-600/70 text-red-100 ring-1 ring-red-300'
      : 'bg-gray-700/60 text-gray-200 ring-1 ring-white/10';

  // Determine timer color and shake intensity based on remaining time
  const getTimerColor = () => {
    const percent = timeRemaining / gameState.turnTimeLimit;
    if (percent > 0.5) return 'text-green-400';
    if (percent > 0.25) return 'text-yellow-400';
    return 'text-red-500';
  };

  const shouldShake = timeRemaining < 3000; // Shake when less than 3 seconds remain

  const handleCardClick = (card: SharedCard) => {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    // Basic multi-select logic for mass attack/defend
    const alreadySelected = selectedCards.find((c) => c.suit === card.suit && c.rank === card.rank);
    if (alreadySelected) {
      setSelectedCards(selectedCards.filter((c) => c !== alreadySelected));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleStartGame = () => {
    room.send('startGame');
  };

  const handleAttack = () => {
    if (selectedCards.length > 0) {
      playCardSound();
      room.send('attack', { cards: selectedCards });
      setSelectedCards([]);
    }
  };

  const handleDefend = () => {
    if (selectedCards.length > 0) {
      playCardSound();
      room.send('defend', { cards: selectedCards });
      setSelectedCards([]);
    }
  };

  const handlePickUp = () => {
    playPickupSound();
    room.send('pickUp');
  };

  const handleToggleReady = () => {
    const isReadyNow = !myPlayer?.isReady;
    room.send('toggleReady', { isReady: isReadyNow });
  };

  const handleSwapHuzur = () => {
    room.send('swapHuzur');
  };

  // ── Drag-and-drop: drop a single card onto the table to play it ──
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [draggingCardKey, setDraggingCardKey] = useState<string | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  // ── Mass-defense staging: build attacker→defender pairs by dragging onto
  // each attacker card individually, then commit the whole defense. ──
  const attackerDropRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [stagedDefense, setStagedDefense] = useState<Record<string, SharedCard>>({});
  const [hoveredAttackerKey, setHoveredAttackerKey] = useState<string | null>(null);
  // Face-down ghosts emitted by the *other* defender currently mid-drag.
  const [ghostStaging, setGhostStaging] = useState<Record<string, Set<string>>>({});
  // ghostStaging[defenderId] = set of attacker keys
  // True while the other player has a card lifted from their hand but not yet staged.
  const [isDraggingActive, setIsDraggingActive] = useState(false);

  const attackerKey = (c: SharedCard) => `${c.suit}:${c.rank}`;

  const isMassDefense = attackCards.length >= 2 && isMyTurn;
  const isAnyDefense = attackCards.length >= 1 && isMyTurn;

  const pointIsInDropZone = (x: number, y: number): boolean => {
    const el = dropZoneRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  // Returns the attacker key whose drop-target the pointer is inside, or null.
  const pointOverAttacker = (x: number, y: number): string | null => {
    for (const [key, el] of attackerDropRefs.current.entries()) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  };

  // Cards in hand that are already staged on some attacker (hidden from hand).
  const stagedCardKeys = new Set(Object.values(stagedDefense).map((c) => `${c.suit}-${c.rank}`));

  const stageDefender = (atkKey: string, defender: SharedCard) => {
    let movedFromKey: string | null = null;
    setStagedDefense((prev) => {
      const next = { ...prev };
      // If the defender was already staged on another attacker, move it.
      for (const k of Object.keys(next)) {
        const c = next[k]!;
        if (c.suit === defender.suit && c.rank === defender.rank) {
          movedFromKey = k;
          delete next[k];
        }
      }
      next[atkKey] = defender;
      return next;
    });
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    if (movedFromKey && movedFromKey !== atkKey) {
      room.send('defendUnstage', { attackerKey: movedFromKey });
    }
    room.send('defendStage', { attackerKey: atkKey });
  };

  const unstageDefender = (atkKey: string) => {
    setStagedDefense((prev) => {
      if (!(atkKey in prev)) return prev;
      const next = { ...prev };
      delete next[atkKey];
      return next;
    });
    room.send('defendUnstage', { attackerKey: atkKey });
  };

  const clearStagedDefense = () => {
    const keys = Object.keys(stagedDefense);
    setStagedDefense({});
    for (const k of keys) room.send('defendUnstage', { attackerKey: k });
  };

  const commitStagedDefense = () => {
    if (attackCards.length === 0) return;
    // Build defender array in the exact order of activeAttackCards.
    const defenders: SharedCard[] = [];
    for (const atk of attackCards) {
      const def = stagedDefense[attackerKey(atk)];
      if (!def) return; // not all attackers covered
      defenders.push(def);
    }
    playCardSound();
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    room.send('defend', { cards: defenders });
    clearStagedDefense();
    setSelectedCards([]);
  };

  // Listen for face-down ghost broadcasts from the active defender.
  useEffect(() => {
    if (!room) return;
    const offGhost = room.onMessage(
      'defenseGhost',
      (data: { defenderId: string; attackerKey: string; action: 'add' | 'remove' }) => {
        setGhostStaging((prev) => {
          const next = { ...prev };
          const set = new Set(next[data.defenderId] ?? []);
          if (data.action === 'add') set.add(data.attackerKey);
          else set.delete(data.attackerKey);
          if (set.size === 0) delete next[data.defenderId];
          else next[data.defenderId] = set;
          return next;
        });
      },
    );
    const offClear = room.onMessage('defenseGhostClear', (data: { defenderId: string | null }) => {
      setGhostStaging((prev) => {
        if (data.defenderId === null) return {};
        if (!(data.defenderId in prev)) return prev;
        const next = { ...prev };
        delete next[data.defenderId];
        return next;
      });
    });
    const offDragging = room.onMessage('defenderDragging', () => {
      setIsDraggingActive(true);
    });
    const offDragEnd = room.onMessage('defenderDragEnd', () => {
      setIsDraggingActive(false);
    });
    return () => {
      offGhost?.();
      offClear?.();
      offDragging?.();
      offDragEnd?.();
    };
  }, [room]);

  // Ghost staging only reflects the current defender. Drop stale entries whenever the
  // turn or active attack composition changes.
  useEffect(() => {
    setGhostStaging({});
    setIsDraggingActive(false);
  }, [gameState.currentTurn, attackCards.length]);

  // Aggregated set of attacker keys currently showing a face-down ghost from any other player.
  // When the defender has a card lifted (isDraggingActive) but hasn't staged it yet,
  // show a ghost on every pending attacker slot so observers know something is happening.
  const ghostedAttackerKeys = (() => {
    const s = new Set<string>();
    for (const set of Object.values(ghostStaging)) for (const k of set) s.add(k);
    if (isDraggingActive && !isMyTurn && attackCards.length > 0) {
      for (const c of attackCards) s.add(attackerKey(c));
    }
    return s;
  })();

  // If the active attack changes (round resolved, picked up, etc.), drop stale staging.
  useEffect(() => {
    if (attackCards.length === 0) {
      if (Object.keys(stagedDefense).length > 0) clearStagedDefense();
      return;
    }
    const liveKeys = new Set(attackCards.map(attackerKey));
    setStagedDefense((prev) => {
      let changed = false;
      const next: Record<string, SharedCard> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (liveKeys.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attackCards.map(attackerKey).join('|')]);

  const playSingleCard = (card: SharedCard) => {
    // Only valid during own turn; pick attack vs defend by table state.
    const action = attackCards.length === 0 ? 'attack' : 'defend';
    playCardSound();
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    room.send(action, { cards: [card] });
    // Clear selection so the manual-select flow isn't left in a stale state.
    setSelectedCards([]);
  };

  const isDevMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('dev') === 'true';

  const isHost = !!gameState.hostId && room.sessionId === gameState.hostId;

  const devSpawnDummies = (difficulty: 'easy' | 'hard' | 'dummy' = 'easy') => {
    if (!isHost) return;
    room.send('dev_action', { action: 'spawn_dummies', difficulty });
  };

  const devForcePass = () => {
    if (!isHost) return;
    room.send('dev_action', { action: 'force_pass' });
  };
  const devCopyLog = () => {
    const logStr = Array.from(gameState.actionLog || []).join('\n');
    navigator.clipboard.writeText(logStr).then(() => alert('Game Log Copied to Clipboard!'));
  };
  const handleDevCardClick = (oppId: string, card: SharedCard) => {
    if (!isDevMode || !isHost) return;
    setDevSelectedCards((prev) => {
      const selected = prev[oppId] || [];
      const alreadySelected = selected.find((c) => c.suit === card.suit && c.rank === card.rank);
      if (alreadySelected) {
        return { ...prev, [oppId]: selected.filter((c) => c !== alreadySelected) };
      }
      return { ...prev, [oppId]: [...selected, card] };
    });
  };

  const handleDevAction = (oppId: string, type: 'attack' | 'defend' | 'pickUp' | 'swapHuzur') => {
    if (!isHost) return;
    room.send('dev_action', {
      action: 'play_as',
      asPlayerId: oppId,
      type,
      cards: devSelectedCards[oppId] || [],
    });
    if (type === 'attack' || type === 'defend') {
      setDevSelectedCards((prev) => ({ ...prev, [oppId]: [] }));
    }
  };

  // ── WAITING PHASE: Full-screen lobby ──
  if (gameState.phase === 'waiting') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-green-950 text-white overflow-hidden safe-p">
        {/* ── Dev Tools (waiting phase) ── */}
        {isDevMode && (
          <div className="absolute top-12 right-2 bg-red-950/90 text-white p-2 rounded-xl border-2 border-red-500 shadow-2xl z-[60] flex flex-col space-y-1 backdrop-blur-md w-40 text-[10px]">
            <div className="font-bold uppercase tracking-widest border-b border-red-500/50 pb-1 text-red-300">
              Dev Tools
            </div>
            <button
              onClick={() => devSpawnDummies('dummy')}
              className="bg-purple-800 hover:bg-purple-700 px-2 py-1 rounded transition border border-purple-600"
            >
              Spawn Dummy
            </button>
            <button
              onClick={() => devSpawnDummies('easy')}
              className="bg-red-800 hover:bg-red-700 px-2 py-1 rounded transition border border-red-600"
            >
              Spawn Easy Bot
            </button>
            <button
              onClick={() => devSpawnDummies('hard')}
              className="bg-orange-800 hover:bg-orange-700 px-2 py-1 rounded transition border border-orange-600"
            >
              Spawn Hard Bot
            </button>
            <button
              onClick={devCopyLog}
              className="bg-blue-800 hover:bg-blue-700 px-2 py-1 rounded transition border border-blue-600"
            >
              Copy Log ({gameState.actionLog?.length || 0})
            </button>
          </div>
        )}
        {/* Compact header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-green-700/50 shrink-0 bg-black/30">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-green-100 truncate">
              ♦ Durak <span className="text-yellow-400">Online</span> ♦
            </h1>
            {isDevMode && (
              <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-orange-300 bg-orange-950/90 px-2 py-0.5 rounded border border-orange-500/45">
                Dev
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Room</span>
            <span className="text-xs font-mono text-yellow-400 bg-black/50 px-2 py-1 rounded border border-yellow-500/20 select-all cursor-pointer">
              {room.id}
            </span>
          </div>
        </div>

        {/* Lobby body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Settings panel */}
          <div className="md:w-1/3 md:max-w-xs bg-black/60 border-b md:border-b-0 md:border-r border-white/10 p-4 flex flex-col shrink-0 md:overflow-y-auto">
            <h2 className="text-lg font-black text-green-100 mb-3 uppercase tracking-wider text-center border-b border-green-700/50 pb-2">
              Game Settings
            </h2>
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Game Mode</label>
                {room.sessionId === gameState.hostId ? (
                  <select
                    value={gameState.mode}
                    onChange={(e) => updateLobbySettings({ mode: e.target.value })}
                    className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                  >
                    <option value="classic">Classic (Free-for-all)</option>
                    <option value="teams">Teams (2v2, 3v3)</option>
                  </select>
                ) : (
                  <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 text-sm font-bold">
                    {gameState.mode === 'teams' ? 'Teams (2v2, 3v3)' : 'Classic (Free-for-all)'}
                  </div>
                )}
              </div>
              {gameState.mode === 'teams' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Team Selection
                  </label>
                  {room.sessionId === gameState.hostId ? (
                    <select
                      value={gameState.teamSelection}
                      onChange={(e) => updateLobbySettings({ teamSelection: e.target.value })}
                      className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                    >
                      <option value="random">Random Assignment</option>
                      <option value="manual">Manual Selection</option>
                    </select>
                  ) : (
                    <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 text-sm font-bold">
                      {gameState.teamSelection === 'manual'
                        ? 'Manual Selection'
                        : 'Random Assignment'}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Max Players</label>
                {room.sessionId === gameState.hostId ? (
                  <select
                    value={gameState.maxPlayers}
                    onChange={(e) => updateLobbySettings({ maxPlayers: parseInt(e.target.value) })}
                    className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} Players
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 text-sm font-bold">
                    {gameState.maxPlayers} Players
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Starting Hand Size
                </label>
                {room.sessionId === gameState.hostId ? (
                  <select
                    value={gameState.targetHandSize}
                    onChange={(e) =>
                      updateLobbySettings({ targetHandSize: parseInt(e.target.value) })
                    }
                    className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                  >
                    {[5, 7].map((n) => (
                      <option key={n} value={n}>
                        {n} Cards
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 text-sm font-bold">
                    {gameState.targetHandSize} Cards
                  </div>
                )}
              </div>

              {isDevMode && (
                <div className="mt-4 pt-4 border-t border-orange-500/35 space-y-2 shrink-0">
                  <h3 className="text-[11px] font-black text-orange-300 uppercase tracking-wider border-b border-orange-500/25 pb-1.5">
                    Developer
                  </h3>
                  <p className="text-[9px] text-gray-500 leading-snug">
                    Dummies are manually controlled via the in-game dev panel. Bots play with AI.
                  </p>
                  <button
                    type="button"
                    onClick={() => devSpawnDummies('dummy')}
                    disabled={!isHost || gameState.players.size >= gameState.maxPlayers}
                    className="w-full bg-purple-900/55 hover:bg-purple-800/70 disabled:opacity-40 disabled:cursor-not-allowed text-purple-50 text-xs font-bold py-2 px-3 rounded-lg border border-purple-500/40 transition"
                  >
                    Spawn dummy (manual control)
                  </button>
                  <button
                    type="button"
                    onClick={() => devSpawnDummies('easy')}
                    disabled={!isHost || gameState.players.size >= gameState.maxPlayers}
                    className="w-full bg-orange-900/55 hover:bg-orange-800/70 disabled:opacity-40 disabled:cursor-not-allowed text-orange-50 text-xs font-bold py-2 px-3 rounded-lg border border-orange-500/40 transition"
                  >
                    Spawn easy bots (fill to {gameState.maxPlayers})
                  </button>
                  <button
                    type="button"
                    onClick={() => devSpawnDummies('hard')}
                    disabled={!isHost || gameState.players.size >= gameState.maxPlayers}
                    className="w-full bg-red-900/55 hover:bg-red-800/70 disabled:opacity-40 disabled:cursor-not-allowed text-red-50 text-xs font-bold py-2 px-3 rounded-lg border border-red-500/40 transition"
                  >
                    Spawn hard bots (fill to {gameState.maxPlayers})
                  </button>
                  <button
                    type="button"
                    onClick={devCopyLog}
                    className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-3 rounded-lg border border-slate-500/35 transition"
                  >
                    Copy action log ({gameState.actionLog?.length || 0})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Players panel */}
          <div className="flex-1 flex flex-col p-4 relative overflow-hidden">
            <div className="flex items-center mb-3 border-b border-green-700/50 pb-2 shrink-0">
              <h2 className="text-lg font-black text-green-100 uppercase tracking-wider flex items-center">
                Lobby
                <span className="ml-2 bg-green-900/50 text-green-300 text-xs px-2 py-0.5 rounded-full border border-green-700/50">
                  {gameState.players.size}/{gameState.maxPlayers}
                </span>
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Array.from(gameState.players.entries()).map(([id, p]) => (
                  <div
                    key={id}
                    className={`flex items-center p-2 rounded-xl border transition-all ${id === room.sessionId ? 'bg-green-900/30 border-green-500/50' : 'bg-black/50 border-white/5'}`}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.username || id}
                        className="w-8 h-8 rounded-full border-2 border-black/50 shadow-md"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center font-bold text-gray-400 text-xs">
                        {(p.username || id).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="ml-2 flex-1 overflow-hidden">
                      <div className="flex items-center space-x-1">
                        <span className="font-bold text-sm text-green-100 truncate">
                          {p.username || id.slice(0, 8)}
                        </span>
                        {id === gameState.hostId && (
                          <span className="bg-yellow-500 text-yellow-900 text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase">
                            Host
                          </span>
                        )}
                        {id === room.sessionId && (
                          <span className="bg-white/10 text-gray-300 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-1">
                      {p.isReady ? (
                        <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-1 rounded-full border border-green-500/30">
                          Ready
                        </span>
                      ) : (
                        <span className="bg-white/5 text-gray-400 text-[10px] font-bold px-2 py-1 rounded-full border border-white/10">
                          Waiting
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile panel — shown when player has a Discord account */}
            {myPlayer?.discordId && (
              <div className="shrink-0 mb-3">
                <PlayerProfilePanel
                  discordId={myPlayer.discordId}
                  username={myPlayer.username}
                  avatarUrl={myPlayer.avatarUrl}
                />
              </div>
            )}

            {/* Action buttons pinned at bottom */}
            <div className="shrink-0 pt-3 border-t border-white/10 mt-2">
              {viewAsSpectator ? (
                <div className="text-center text-purple-300 text-sm font-bold py-3">
                  👁 Spectating
                </div>
              ) : room.sessionId === gameState.hostId ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleReady}
                    className={`px-4 py-2 text-xs rounded-lg font-bold transition-all ${myPlayer?.isReady ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  >
                    {myPlayer?.isReady ? '✓ Ready' : 'Mark Ready'}
                  </button>
                  <button
                    onClick={startLobbyGame}
                    disabled={
                      gameState.players.size < 2 ||
                      !Array.from(gameState.players.values()).every((p) => p.isReady)
                    }
                    className={`flex-1 py-2 rounded-lg font-black text-base shadow-lg transition-all ${gameState.players.size >= 2 && Array.from(gameState.players.values()).every((p) => p.isReady) ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 hover:scale-105 active:scale-95' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                  >
                    START GAME
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleToggleReady}
                  className={`w-full py-3 font-black text-base rounded-xl shadow-lg transition-all ${myPlayer?.isReady ? 'bg-green-500 hover:bg-green-400 text-green-900 ring-2 ring-green-300' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                >
                  {myPlayer?.isReady ? 'READY TO PLAY' : 'CLICK TO READY'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Compute opponents for seat positioning ──
  const seatOrder = Array.from(gameState.seatOrder);
  let opponents: { id: string; player: Player }[] = [];
  if (viewAsSpectator) {
    // Spectators see all players arranged around the oval
    if (seatOrder.length > 0) {
      opponents = seatOrder
        .filter((id): id is string => !!id)
        .map((id) => ({ id, player: gameState.players.get(id) }))
        .filter((e): e is { id: string; player: Player } => !!e.player);
    } else {
      opponents = Array.from(gameState.players.entries()).map(([id, player]) => ({ id, player }));
    }
  } else if (seatOrder.length > 0) {
    const myIdx = seatOrder.indexOf(room.sessionId);
    if (myIdx !== -1) {
      for (let i = 1; i < seatOrder.length; i++) {
        const oppId = seatOrder[(myIdx + i) % seatOrder.length];
        if (!oppId) continue;
        const oppPlayer = gameState.players.get(oppId);
        if (oppPlayer) opponents.push({ id: oppId, player: oppPlayer });
      }
    }
  } else {
    opponents = Array.from(gameState.players.entries())
      .filter(([id]) => id !== room.sessionId)
      .map(([id, player]) => ({ id, player }))
      .sort((a, b) => (a.player.team || 0) - (b.player.team || 0));
  }

  // Clockwise seat positions around the oval
  const SEAT_POSITIONS: Record<number, Array<{ top: string; left: string }>> = {
    1: [{ top: '6%', left: '50%' }],
    2: [
      { top: '20%', left: '16%' },
      { top: '20%', left: '84%' },
    ],
    3: [
      { top: '44%', left: '6%' },
      { top: '6%', left: '50%' },
      { top: '44%', left: '94%' },
    ],
    4: [
      { top: '58%', left: '6%' },
      { top: '14%', left: '14%' },
      { top: '14%', left: '86%' },
      { top: '58%', left: '94%' },
    ],
    5: [
      { top: '62%', left: '6%' },
      { top: '22%', left: '8%' },
      { top: '6%', left: '50%' },
      { top: '22%', left: '92%' },
      { top: '62%', left: '94%' },
    ],
    6: [
      { top: '70%', left: '10%' },
      { top: '22%', left: '6%' },
      { top: '6%', left: '28%' },
      { top: '6%', left: '72%' },
      { top: '22%', left: '94%' },
      { top: '70%', left: '90%' },
    ],
  };
  const seatPositions = SEAT_POSITIONS[opponents.length] || SEAT_POSITIONS[1] || [];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-green-950 overflow-hidden safe-p text-white relative">
      {suhuhResult && (
        <SuhuhReveal
          draws={suhuhResult.draws}
          winnerId={suhuhResult.winnerId}
          players={gameState.players as unknown as Map<string, Player>}
          seatOrder={Array.from(gameState.seatOrder).filter((id): id is string => id != null)}
          onDone={clearSuhuhResult}
        />
      )}
      {tierChange && (
        <TierChangeOverlay
          oldTier={tierChange.oldTier}
          newTier={tierChange.newTier}
          direction={tierChange.direction}
          onDismiss={() => setTierChange(null)}
        />
      )}
      {/* ── Info Bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-green-800/50 shrink-0 z-20">
        <div className="flex items-center gap-3 text-xs">
          {isMyTurn && (
            <motion.div
              animate={shouldShake ? { x: [0, -2, 2, -2, 0] } : { x: 0 }}
              transition={shouldShake ? { duration: 0.3, repeat: Infinity } : { duration: 0 }}
              className={`font-bold tabular-nums ${getTimerColor()}`}
            >
              ⏳ {(timeRemaining / 1000).toFixed(1)}s
            </motion.div>
          )}
          <span className="text-gray-400">
            🃏 <span className="text-white font-bold">{gameState.deck?.length || 0}</span>
          </span>
          {gameState.huzurCard && (
            <span className="text-yellow-400 font-bold">♦ {gameState.huzurSuit}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {gameState.mode === 'teams' && !viewAsSpectator && myPlayer && (
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${myTeamBadge}`}>
              {myTeamLabel}
            </div>
          )}
          {viewAsSpectator && (
            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full">
              👁 SPECTATING
            </span>
          )}
          {!viewAsSpectator && isMyTurn && (
            <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-full animate-pulse">
              YOUR TURN
            </span>
          )}
          {(gameState.spectatorCount ?? 0) > 0 && (
            <span className="text-[10px] text-gray-400">👁 {gameState.spectatorCount}</span>
          )}
        </div>
      </div>

      {/* ── Game Message Toast ── */}
      <AnimatePresence>
        {gameMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 bg-red-600 border border-red-400 font-bold text-white px-4 py-2 rounded-lg shadow-2xl flex items-center z-50 text-sm max-w-[90%]"
          >
            <span>{gameMessage}</span>
            <button
              onClick={clearGameMessage}
              aria-label="Dismiss message"
              className="text-red-200 hover:text-white ml-3"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Developer (in-match) ── */}
      {isDevMode && (
        <div className="absolute top-12 right-2 bg-orange-950/92 text-white p-2 rounded-xl border-2 border-orange-500/70 shadow-2xl z-50 flex flex-col space-y-1.5 backdrop-blur-md w-44 text-[10px]">
          <div className="font-black uppercase tracking-wider border-b border-orange-500/45 pb-1 text-orange-200">
            Developer
          </div>
          <button
            type="button"
            onClick={() => devSpawnDummies('dummy')}
            disabled={!isHost}
            className="bg-purple-900/75 hover:bg-purple-800 px-2 py-1.5 rounded-lg transition border border-purple-500/45 font-bold text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Spawn dummy
          </button>
          <button
            type="button"
            onClick={() => devSpawnDummies('easy')}
            disabled={!isHost}
            className="bg-orange-900/75 hover:bg-orange-800 px-2 py-1.5 rounded-lg transition border border-orange-500/45 font-bold text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Spawn easy bot
          </button>
          <button
            type="button"
            onClick={() => devSpawnDummies('hard')}
            disabled={!isHost}
            className="bg-red-900/75 hover:bg-red-800 px-2 py-1.5 rounded-lg transition border border-red-500/45 font-bold text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Spawn hard bot
          </button>
          <button
            type="button"
            onClick={devForcePass}
            disabled={!isHost}
            className="bg-orange-900/75 hover:bg-orange-800 px-2 py-1.5 rounded-lg transition border border-orange-500/45 font-bold text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Force pass turn
          </button>
          <button
            type="button"
            onClick={devCopyLog}
            className="bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition border border-slate-500/45 font-bold text-left"
          >
            Copy log ({gameState.actionLog?.length || 0})
          </button>
        </div>
      )}

      {/* ── Oval Table Area ── */}
      <div className="flex-1 relative min-h-0">
        {/* Oval felt surface — also the drop zone for drag-to-play */}
        <div
          ref={dropZoneRef}
          className={`absolute inset-3 md:inset-8 rounded-[50%] bg-[radial-gradient(ellipse_at_center,#1a5c2e,#0a3618)] border-2 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)] transition-colors duration-150 ${
            draggingCardKey
              ? isOverDropZone
                ? 'border-yellow-300 shadow-[inset_0_0_80px_rgba(250,204,21,0.45)]'
                : 'border-yellow-500/60'
              : 'border-yellow-900/30'
          }`}
        >
          {/* Deck + Trump — pinned to the oval's left edge so played cards never collide with it */}
          {gameState.phase === 'playing' && gameState.huzurCard && (
            <div className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 pointer-events-none">
              <div className="relative w-8 h-12 md:w-10 md:h-14">
                {(gameState.deck?.length || 0) > 0 ? (
                  <>
                    <div className="absolute inset-0 bg-red-900 rounded border border-white/20 shadow-md flex items-center justify-center">
                      <span className="text-white font-black text-[10px] md:text-xs">
                        {gameState.deck?.length}
                      </span>
                    </div>
                    <div className="absolute inset-0 translate-x-0.5 -translate-y-0.5 bg-red-950 rounded border border-white/10 -z-10" />
                  </>
                ) : (
                  <div className="absolute inset-0 rounded border border-dashed border-white/20 bg-black/20" />
                )}
              </div>
              <UICard
                card={gameState.huzurCard}
                compact
                className="border-yellow-500 shadow-[0_0_8px_rgba(250,204,21,0.4)]"
              />
            </div>
          )}

          {/* Center: Table Cards (played pairs) — kept clear of the deck/trump cluster */}
          <div className="absolute inset-0 flex items-center justify-center px-24 md:px-32 pointer-events-none">
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 p-2 max-w-full pointer-events-auto">
              {/* Table stack — pair-aware: shows atk→def pairing explicitly so mass attack
                  defenses are obvious. Hidden while the discard overlay is active. */}
              <AnimatePresence>
                {!discardedCards &&
                  (() => {
                    // Build pairs from tableStacks (consecutive [atk, def] entries)
                    type Pair = { atk: SharedCard; def?: SharedCard; pairKey: string };
                    const pairs: Pair[] = [];
                    const defSeen = new Set<string>();
                    for (let i = 0; i < tableCards.length; i += 2) {
                      const atk = tableCards[i];
                      if (!atk) continue;
                      const def = tableCards[i + 1];
                      // Skip later "pair" entries whose atk is just a previous def
                      // (chain re-uses def cards as the next round of attackers)
                      const atkKey = `${atk.suit}:${atk.rank}`;
                      if (defSeen.has(atkKey)) continue;
                      if (def) defSeen.add(`${def.suit}:${def.rank}`);
                      pairs.push({
                        atk,
                        def,
                        pairKey: `${atkKey}-${def ? `${def.suit}:${def.rank}` : 'open'}`,
                      });
                    }
                    // Active attacks not yet attached to any pair — fresh incoming attacks
                    const pairedKeys = new Set([
                      ...pairs.map((p) => `${p.atk.suit}:${p.atk.rank}`),
                      ...pairs.filter((p) => p.def).map((p) => `${p.def!.suit}:${p.def!.rank}`),
                    ]);
                    const freshAttacks = attackCards.filter(
                      (c) => !pairedKeys.has(`${c.suit}:${c.rank}`),
                    );
                    // If there are pending pairs (atk played, def not yet), merge fresh attacks into them.
                    // Otherwise fresh attacks render standalone.
                    const renderItems: Pair[] = [
                      ...pairs,
                      ...freshAttacks.map((atk) => ({
                        atk,
                        def: undefined,
                        pairKey: `fresh-${atk.suit}:${atk.rank}`,
                      })),
                    ];
                    return renderItems.map((p, i) => {
                      const rotate =
                        (i % 2 === 0 ? -3 : 3) + (i - (renderItems.length - 1) / 2) * 4;
                      const atkKey = attackerKey(p.atk);
                      // isPendingAttacker: card still needs a defender (visible to everyone)
                      const isPendingAttacker =
                        !p.def && attackCards.some((c) => attackerKey(c) === atkKey);
                      // Only the current defender gets interactive drop zones
                      const isDropTarget = isPendingAttacker && isMyTurn;
                      const staged = isDropTarget ? stagedDefense[atkKey] : undefined;
                      const isHovered =
                        isDropTarget && hoveredAttackerKey === atkKey && !!draggingCardKey;
                      const showGhost =
                        isPendingAttacker &&
                        !staged &&
                        !isMyTurn &&
                        ghostedAttackerKeys.has(atkKey);

                      return (
                        <motion.div
                          key={`pair-${p.pairKey}`}
                          initial={{ opacity: 0, scale: 0.85, y: 12 }}
                          animate={{ opacity: 1, scale: 1, y: 0, rotate }}
                          exit={{ opacity: 0, scale: 1, transition: { duration: 0 } }}
                          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                          style={{ zIndex: i }}
                          className="relative flex-shrink-0"
                        >
                          {isPendingAttacker ? (
                            /* ── Per-card drop zone: slot above, attacker below ── */
                            <div
                              ref={(el) => {
                                if (isDropTarget) attackerDropRefs.current.set(atkKey, el);
                                else attackerDropRefs.current.delete(atkKey);
                              }}
                              className={`flex flex-col items-center gap-0.5 rounded-lg p-0.5 transition-all duration-150 ${
                                isHovered
                                  ? 'bg-yellow-400/10 shadow-[0_0_20px_rgba(250,204,21,0.5)]'
                                  : ''
                              }`}
                            >
                              {/* Defender slot — shows staged card, ghost, or empty placeholder */}
                              <div
                                className={`w-12 h-[72px] rounded-md border-2 flex items-center justify-center transition-all duration-150 relative overflow-hidden ${
                                  staged
                                    ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.55)]'
                                    : isHovered
                                      ? 'border-yellow-300 bg-yellow-300/20'
                                      : 'border-dashed border-white/25 bg-white/5'
                                }`}
                              >
                                {staged ? (
                                  /* Staged card is draggable — lets the defender move it
                                     directly from one attacker slot to another. */
                                  <motion.div
                                    key={`staged-${atkKey}-${staged.suit}-${staged.rank}`}
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                    style={{ touchAction: 'none' }}
                                    drag={isDropTarget}
                                    dragSnapToOrigin
                                    dragElastic={0.4}
                                    dragMomentum={false}
                                    whileDrag={{ scale: 1.15, zIndex: 200 }}
                                    onTap={() => {
                                      if (isDropTarget) unstageDefender(atkKey);
                                    }}
                                    onDragStart={() => {
                                      setDraggingCardKey(`slot-${atkKey}`);
                                      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                                      room.send('defenderDragging');
                                    }}
                                    onDrag={(_, info) => {
                                      setHoveredAttackerKey(
                                        pointOverAttacker(info.point.x, info.point.y),
                                      );
                                    }}
                                    onDragEnd={(_, info) => {
                                      const target = pointOverAttacker(info.point.x, info.point.y);
                                      setDraggingCardKey(null);
                                      setHoveredAttackerKey(null);
                                      room.send('defenderDragEnd');
                                      if (target && target !== atkKey) {
                                        stageDefender(target, staged);
                                      }
                                    }}
                                  >
                                    <div className="pointer-events-none">
                                      <UICard card={staged} compact />
                                    </div>
                                  </motion.div>
                                ) : showGhost ? (
                                  <motion.div
                                    key={`ghost-${atkKey}`}
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 0.95, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                                    className="absolute inset-0 rounded-md ring-1 ring-white/20"
                                    style={{
                                      background:
                                        'repeating-linear-gradient(45deg,#7f1d1d 0 6px,#991b1b 6px 12px)',
                                    }}
                                  >
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-white/80 text-lg">★</span>
                                    </div>
                                  </motion.div>
                                ) : (
                                  <span
                                    className={`text-2xl font-thin select-none transition-colors ${
                                      isHovered ? 'text-yellow-300' : 'text-white/20'
                                    }`}
                                  >
                                    +
                                  </span>
                                )}
                              </div>
                              {/* Attacker card — the card that must be beaten */}
                              <UICard card={p.atk} compact />
                            </div>
                          ) : (
                            /* ── Resolved pair: attacker with defender overlaid ── */
                            <div className="relative">
                              <UICard card={p.atk} compact />
                              {p.def && (
                                <motion.div
                                  initial={{ opacity: 0, x: -6, y: -6, rotate: -8 }}
                                  animate={{ opacity: 1, x: 0, y: 0, rotate: 8 }}
                                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                                  className="absolute left-3 top-3 ring-1 ring-green-400/50 rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                                >
                                  <UICard card={p.def} compact />
                                </motion.div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    });
                  })()}
              </AnimatePresence>

              {/* Defense reveal — 1.5s window after round ends, before discard animation */}
              <AnimatePresence>
                {defenseRevealPairs && !discardedCards && (
                  <motion.div
                    key="defense-reveal"
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {(defenseRevealPairs as RevealPair[]).map((pair, i) => (
                        <div key={i} className="relative flex-shrink-0">
                          <UICard card={pair.atk as unknown as SharedCard} compact />
                          {/* Defender card flips in — rotateY -90→0 simulates flipping face-up */}
                          <motion.div
                            initial={{ rotateY: -90 }}
                            animate={{ rotateY: 0 }}
                            transition={{
                              duration: 0.42,
                              ease: [0.25, 0.46, 0.45, 0.94],
                              delay: i * 0.1,
                            }}
                            style={{ transformPerspective: 900, rotate: 8 }}
                            className="absolute left-3 top-3 ring-1 ring-green-400/60 rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                          >
                            <UICard card={pair.def as unknown as SharedCard} compact />
                          </motion.div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Discard animation — shown briefly after a successful defense round */}
              <AnimatePresence>
                {discardedCards &&
                  discardedCards.length > 0 &&
                  (() => {
                    // Server sends raw tableStacks (each card appears twice in a chain — as the
                    // def in one pair and the atk in the next) plus activeAttackCards (the latest
                    // defs again). Dedupe so the discard pile is clean.
                    const seen = new Set<string>();
                    const uniqueDiscarded = discardedCards.filter((c) => {
                      const k = `${c.suit}:${c.rank}`;
                      if (seen.has(k)) return false;
                      seen.add(k);
                      return true;
                    });
                    return (
                      <motion.div
                        key="discard-pile"
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        {uniqueDiscarded.map((card, i) => (
                          <motion.div
                            key={`discard-${card.suit}-${card.rank}-${i}`}
                            initial={{
                              opacity: 1,
                              y: 0,
                              scale: 1,
                              rotate: (i % 2 === 0 ? -3 : 3) + (i * 1.5 - uniqueDiscarded.length),
                            }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{
                              opacity: 0,
                              y: -55,
                              scale: 0.45,
                              rotate: i % 2 === 0 ? -15 : 15,
                              transition: { duration: 0.38, delay: i * 0.035, ease: 'easeIn' },
                            }}
                            style={{ marginLeft: i > 0 ? '-28px' : 0, zIndex: i }}
                            className="flex-shrink-0"
                          >
                            <UICard card={card as unknown as SharedCard} compact />
                          </motion.div>
                        ))}
                      </motion.div>
                    );
                  })()}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Opponent Seats (clockwise around the oval) ── */}
        {opponents.map(({ id, player }, i) => {
          const pos = seatPositions[i] || { top: '10%', left: '50%' };
          const isPlaying = gameState.currentTurn === id;

          return (
            <div
              key={id}
              className="absolute z-10 flex flex-col items-center -translate-x-1/2"
              style={{ top: pos.top, left: pos.left }}
            >
              <div
                className={`flex flex-col items-center p-1 md:p-1.5 rounded-xl transition-all ${
                  isPlaying
                    ? 'bg-yellow-500/20 ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                    : ''
                }`}
              >
                {player.avatarUrl ? (
                  <img
                    src={player.avatarUrl}
                    alt={player.username || id}
                    className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-black/50 shadow"
                  />
                ) : (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-gray-400 text-[8px]">
                    {(player.username || id).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-[9px] md:text-[11px] font-bold text-gray-300 truncate max-w-[55px] md:max-w-[100px] mt-0.5">
                  {player.username || id.slice(0, 6)}
                </span>
                <span className="text-[9px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded-full mt-0.5">
                  🃏{player.hand.length}
                </span>
                {gameState.mode === 'teams' && (
                  <span
                    className={`text-[7px] font-bold px-1 py-0.5 rounded mt-0.5 ${
                      player.team === 0 ? 'bg-blue-700 text-blue-100' : 'bg-red-700 text-red-100'
                    }`}
                  >
                    {player.team === 0 ? 'BLU' : 'RED'}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Dev mode: show opponent hands inline (simplified for oval) */}
        {isDevMode &&
          opponents.map(({ id, player }, i) => {
            const pos = seatPositions[i] || { top: '10%', left: '50%' };
            return (
              <div
                key={`dev-${id}`}
                className="absolute z-20 -translate-x-1/2"
                style={{
                  top: `calc(${pos.top} + 70px)`,
                  left: pos.left,
                }}
              >
                <div className="flex gap-0.5 bg-black/60 p-1 rounded border border-red-500/30">
                  {Array.from(player.hand)
                    .filter((c): c is SharedCard => c !== undefined)
                    .map((c, ci) => (
                      <div
                        key={ci}
                        onClick={() => handleDevCardClick(id, c)}
                        className={`${!isHost ? 'pointer-events-none' : 'cursor-pointer'} ${
                          (devSelectedCards[id] || []).find(
                            (sc) => sc.suit === c.suit && sc.rank === c.rank,
                          )
                            ? 'ring-1 ring-yellow-400 -translate-y-1'
                            : ''
                        }`}
                      >
                        <UICard card={c} compact />
                      </div>
                    ))}
                </div>
                <div className="flex gap-0.5 mt-0.5 justify-center">
                  <button
                    disabled={!isHost}
                    onClick={() => handleDevAction(id, 'attack')}
                    className="bg-red-600 text-[8px] px-1 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Atk
                  </button>
                  <button
                    disabled={!isHost}
                    onClick={() => handleDevAction(id, 'defend')}
                    className="bg-green-600 text-[8px] px-1 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Def
                  </button>
                  <button
                    disabled={!isHost}
                    onClick={() => handleDevAction(id, 'pickUp')}
                    className="bg-yellow-600 text-[8px] px-1 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Pick
                  </button>
                  <button
                    disabled={!isHost}
                    onClick={() => handleDevAction(id, 'swapHuzur')}
                    className="bg-purple-600 text-[8px] px-1 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Swap
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* ── Action Buttons ── */}
      {gameState.phase === 'playing' && !viewAsSpectator && (
        <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 px-2 py-1 shrink-0 z-20 touch-manipulation">
          {isMyTurn && attackCards.length === 0 && (
            <button
              onClick={handleAttack}
              disabled={selectedCards.length === 0}
              className="px-4 py-1.5 md:px-6 md:py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-full font-bold shadow-lg text-xs md:text-sm active:scale-95 transition"
            >
              ⚔ Attack ({selectedCards.length})
            </button>
          )}
          {isMyTurn && attackCards.length > 0 && (
            <>
              {(() => {
                const stagedCount = Object.keys(stagedDefense).length;
                const needCount = attackCards.length;
                const allStaged = stagedCount > 0 && stagedCount === needCount;
                return (
                  <>
                    {stagedCount > 0 ? (
                      <>
                        <button
                          onClick={commitStagedDefense}
                          disabled={!allStaged}
                          className="px-4 py-1.5 md:px-6 md:py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-full font-bold shadow-lg text-xs md:text-sm active:scale-95 transition"
                        >
                          ✓ Confirm Defense ({stagedCount}/{needCount})
                        </button>
                        <button
                          onClick={clearStagedDefense}
                          className="px-4 py-1.5 md:px-6 md:py-2 bg-gray-700 hover:bg-gray-600 rounded-full font-bold shadow-lg text-xs md:text-sm active:scale-95 transition"
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleDefend}
                        disabled={selectedCards.length === 0}
                        className="px-4 py-1.5 md:px-6 md:py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-full font-bold shadow-lg text-xs md:text-sm active:scale-95 transition"
                      >
                        🛡 Defend ({selectedCards.length})
                      </button>
                    )}
                  </>
                );
              })()}
              <button
                onClick={handlePickUp}
                className="px-4 py-1.5 md:px-6 md:py-2 bg-yellow-600 hover:bg-yellow-500 rounded-full text-yellow-900 font-bold shadow-lg text-xs md:text-sm active:scale-95 transition"
              >
                Pick Up
              </button>
            </>
          )}
          {gameState.phase === 'playing' &&
            (gameState.deck?.length || 0) > 0 &&
            gameState.huzurCard &&
            (gameState.huzurCard.isJoker
              ? myHand.some((c) => c.suit === 'Spades' && c.rank === 16) &&
                !myPlayer?.pickedUpCardKeys.includes('Spades:16:0') && (
                  <button
                    onClick={handleSwapHuzur}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-full font-bold shadow-lg text-xs active:scale-95 transition"
                  >
                    Swap Ace
                  </button>
                )
              : myHand.some((c) => c.suit === gameState.huzurSuit && c.rank === 7) &&
                !myPlayer?.pickedUpCardKeys.includes(`${gameState.huzurSuit}:7:0`) && (
                  <button
                    onClick={handleSwapHuzur}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-full font-bold shadow-lg text-xs active:scale-95 transition"
                  >
                    Swap 7
                  </button>
                ))}
        </div>
      )}

      {/* ── Player Hand ── */}
      {!viewAsSpectator && (
        <div
          className={`shrink-0 bg-black/30 border-t border-white/10 transition-all duration-300 ${
            draggingCardKey ? 'overflow-visible' : 'overflow-hidden'
          } ${isMyTurn ? 'pb-2 pt-1' : 'pb-1 pt-0.5'}`}
        >
          <div
            className={`flex flex-row items-end md:justify-center w-full px-1 md:px-4 custom-scrollbar ${
              draggingCardKey ? 'overflow-visible' : 'overflow-x-auto md:overflow-x-visible'
            }`}
            style={{ minHeight: isMyTurn ? '80px' : '64px' }}
          >
            <div className="flex flex-row w-max md:w-auto md:max-w-full md:justify-center gap-1 md:gap-0 px-1 md:px-0">
              <AnimatePresence>
                {myHand.map((card, i) => {
                  const isSelected = !!selectedCards.find(
                    (c) => c.suit === card.suit && c.rank === card.rank,
                  );
                  const animationDelayMs = i * 150;
                  const overlapAmount =
                    isDesktop && myHand.length > 7 ? Math.min(80, (myHand.length - 7) * 4) : 0;
                  const cardKey = `${card.suit}-${card.rank}`;
                  const isDraggingThis = draggingCardKey === cardKey;
                  const isStaged = stagedCardKeys.has(cardKey);
                  // Allow drag only on the player's own turn — otherwise a drop would just bounce back.
                  const canDrag = isMyTurn && !isStaged;

                  return (
                    <motion.div
                      key={cardKey}
                      layoutId={isDraggingThis ? undefined : `card-${card.suit}-${card.rank}`}
                      initial={{ opacity: 0, y: 60, scale: 0.5 }}
                      animate={{
                        opacity: isStaged ? 0.25 : 1,
                        y: isSelected ? -12 : 0,
                        scale: isMyTurn ? 1.05 : 1,
                      }}
                      exit={{ opacity: 0, scale: 0.5, y: -100 }}
                      transition={{
                        type: 'spring',
                        stiffness: 280,
                        damping: 25,
                        delay: i * 0.1,
                        mass: 0.8,
                      }}
                      style={{
                        marginLeft: i > 0 && isDesktop ? `-${overlapAmount}px` : undefined,
                        zIndex: isDraggingThis ? 200 : isSelected ? 100 : i,
                        touchAction: canDrag ? 'none' : undefined,
                      }}
                      drag={canDrag}
                      dragSnapToOrigin
                      dragElastic={0.4}
                      dragMomentum={false}
                      whileDrag={{ scale: 1.2, zIndex: 200 }}
                      onTap={() => handleCardClick(card)}
                      onDragStart={() => {
                        setDraggingCardKey(cardKey);
                        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                        if (isAnyDefense) room.send('defenderDragging');
                      }}
                      onDrag={(_, info) => {
                        // Prefer landing on a specific attacker (mass defense pairing).
                        const overAttacker = isAnyDefense
                          ? pointOverAttacker(info.point.x, info.point.y)
                          : null;
                        setHoveredAttackerKey(overAttacker);
                        setIsOverDropZone(
                          !overAttacker && pointIsInDropZone(info.point.x, info.point.y),
                        );
                      }}
                      onDragEnd={(_, info) => {
                        const overAttacker = isAnyDefense
                          ? pointOverAttacker(info.point.x, info.point.y)
                          : null;
                        const droppedOnTable =
                          !overAttacker && pointIsInDropZone(info.point.x, info.point.y);
                        setDraggingCardKey(null);
                        setHoveredAttackerKey(null);
                        setIsOverDropZone(false);
                        room.send('defenderDragEnd');
                        if (overAttacker) {
                          // Defense pairing: stage this card on the chosen attacker.
                          if (isMassDefense) {
                            stageDefender(overAttacker, card);
                          } else {
                            // Single-attack defense: drop on attacker = play immediately.
                            playSingleCard(card);
                          }
                        } else if (droppedOnTable) {
                          // Attack OR single-card defense fallback.
                          if (isMassDefense) {
                            // Don't auto-commit during mass defense — require explicit Confirm.
                            // Treat as a stage-on-first-uncovered-attacker convenience.
                            const firstUncovered = attackCards.find(
                              (c) => !stagedDefense[attackerKey(c)],
                            );
                            if (firstUncovered) stageDefender(attackerKey(firstUncovered), card);
                          } else {
                            playSingleCard(card);
                          }
                        }
                      }}
                      className={`rounded-lg flex-shrink-0 relative ${
                        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'shadow-[0_8px_16px_rgba(250,204,21,0.5)] ring-2 ring-yellow-400'
                          : isDesktop && !isDraggingThis
                            ? 'hover:shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:-translate-y-3 hover:z-[90]'
                            : ''
                      }`}
                    >
                      <DealSoundTrigger delayMs={animationDelayMs} playSound={playDealSound} />
                      {/* Inner UICard pointer-events are disabled so the parent motion.div
                          captures pointerdown for drag and tap. */}
                      <div className="pointer-events-none">
                        <UICard card={card} isPlayable={true} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div className="w-2 flex-shrink-0 md:hidden" />
            </div>
          </div>
        </div>
      )}

      {/* ── Own Connection Lost Banner ── */}
      <AnimatePresence>
        {connectionStatus === 'reconnecting' && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-0 inset-x-0 z-[90] flex items-center justify-center pointer-events-none"
          >
            <div className="mt-12 flex items-center gap-3 bg-amber-900/95 border border-amber-400/60 text-amber-100 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-sm">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="font-bold text-sm tracking-wide">
                Connection lost — reconnecting…
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Opponent Disconnected Banner ── */}
      <AnimatePresence>
        {connectionStatus === 'waiting_opponent' && disconnectedOpponent && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute bottom-0 inset-x-0 z-[90] flex items-center justify-center pointer-events-none"
          >
            <div className="mb-20 flex items-center gap-3 bg-gray-900/95 border border-white/20 text-gray-200 px-5 py-2.5 rounded-xl shadow-xl backdrop-blur-sm">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm">
                Waiting for <span className="font-bold text-white">{disconnectedOpponent}</span> to
                reconnect… <span className="text-gray-400 text-xs">(they have 30s)</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Emote Toast ── */}
      {emoteToast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none">
          {emoteToast.username}: {emoteToast.emoteId}
        </div>
      )}

      {/* ── Emote Wheel ── */}
      {!viewAsSpectator && gameState.phase === 'playing' && (
        <div className="absolute bottom-4 right-4 z-50">
          <EmoteWheel room={room} />
        </div>
      )}

      {/* ── Game Over Overlay ── */}
      {gameState.phase === 'finished' && (
        <div
          className="absolute inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md safe-p"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
        >
          <div className="bg-gray-900 border-2 border-yellow-500 rounded-3xl p-6 md:p-12 flex flex-col items-center shadow-[0_0_50px_rgba(250,204,21,0.3)] text-center max-w-sm md:max-w-lg w-[90%]">
            {gameState.loser === room.sessionId ? (
              <>
                <h1
                  className="text-5xl md:text-7xl mb-4 pb-3 border-b border-gray-700 w-full"
                  aria-hidden="true"
                >
                  🥴
                </h1>
                <h2
                  id="game-over-title"
                  className="text-2xl md:text-4xl font-extrabold text-red-500 mb-2"
                >
                  YOU ARE THE DURAK!
                </h2>
                <p className="text-gray-400 text-sm md:text-lg">Better luck next time.</p>
              </>
            ) : gameState.loser === null ? (
              <>
                <h1
                  className="text-5xl md:text-7xl mb-4 pb-3 border-b border-gray-700 w-full"
                  aria-hidden="true"
                >
                  🤝
                </h1>
                <h2
                  id="game-over-title"
                  className="text-2xl md:text-4xl font-extrabold text-blue-400 mb-2"
                >
                  DRAW!
                </h2>
                <p className="text-gray-400 text-sm md:text-lg">Everybody wins (or loses?).</p>
              </>
            ) : (
              <>
                <h1
                  className="text-5xl md:text-7xl mb-4 pb-3 border-b border-gray-700 w-full"
                  aria-hidden="true"
                >
                  👑
                </h1>
                <h2
                  id="game-over-title"
                  className="text-2xl md:text-4xl font-extrabold text-yellow-400 mb-2"
                >
                  YOU SURVIVED!
                </h2>
                <p className="text-gray-400 text-sm md:text-lg">
                  The fool is {gameState.loser.slice(0, 5)}...
                </p>
              </>
            )}
            <button
              onClick={handleStartGame}
              className="mt-6 md:mt-10 px-8 py-3 md:px-10 md:py-5 bg-gradient-to-br from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-yellow-950 font-black text-lg md:text-2xl rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)] transition active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
