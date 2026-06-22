import React, { useState, useEffect, useRef } from 'react';
import { useGame, type RevealPair } from '../contexts/GameContext';
import { Card as UICard } from './Card';
import { PlayingCard } from './PlayingCard';
import { Card as SharedCard, Player } from '@durak/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import { useAudio } from '../utils/audio';
import { useIsDesktop } from '../utils/useIsDesktop';
import { useIsShortViewport } from '../utils/useIsShortViewport';
import { SuhuhReveal } from './SuhuhReveal';
import { PlayerProfilePanel } from './PlayerProfilePanel';
import { useSettings } from '../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';

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
    eloResult,
    rematchState,
    gameAbortReason,
    clearGameAbortReason,
    sendRematchVote,
    serverTimeOffset,
    updateLobbySettings,
    startLobbyGame,
    isSpectator,
    connectionStatus,
    disconnectedOpponent,
    leaveGame,
  } = useGame();
  const { settings } = useSettings();
  const { t } = useTranslation('game');
  const [selectedCards, setSelectedCards] = useState<SharedCard[]>([]);
  const [devSelectedCards, setDevSelectedCards] = useState<Record<string, SharedCard[]>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [hasVotedRematch, setHasVotedRematch] = useState(false);
  const {
    playDealSound,
    playCardSound,
    playPickupSound,
    playTimerWarning,
    playVictorySound,
    playDefeatSound,
    playDiscardSound,
  } = useAudio(settings.soundEffects);
  const isDesktop = useIsDesktop();
  const isShort = useIsShortViewport();
  const warningPlayedRef = React.useRef(false);
  const gameResultKeyRef = React.useRef<string | null>(null);

  // Update timer smoothly using requestAnimationFrame
  // Lock to landscape while in a game; restore on leave
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
    return () => {
      ScreenOrientation.unlock().catch(() => {});
    };
  }, []);

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

  // Reset rematch vote when a new game starts so the button reappears
  React.useEffect(() => {
    if (gameState?.phase === 'playing') setHasVotedRematch(false);
  }, [gameState?.phase]);

  // ── Drag-and-drop state (declared before early return to satisfy rules-of-hooks) ──
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [draggingCardKey, setDraggingCardKey] = useState<string | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const attackerDropRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [stagedDefense, setStagedDefense] = useState<Record<string, SharedCard>>({});
  const [hoveredAttackerKey, setHoveredAttackerKey] = useState<string | null>(null);
  const [ghostStaging, setGhostStaging] = useState<Record<string, Set<string>>>({});
  const [isDraggingActive, setIsDraggingActive] = useState(false);

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

  // Ghost staging only reflects the current defender. Drop stale entries whenever turn/attack changes.
  useEffect(() => {
    setGhostStaging({});
    setIsDraggingActive(false);
  }, [gameState?.currentTurn, gameState?.activeAttackCards?.length]);

  // If the active attack changes, drop stale staging.
  useEffect(() => {
    const currentAttackCards = Array.from(gameState?.activeAttackCards || []).filter(
      (c): c is SharedCard => c !== undefined,
    );
    if (currentAttackCards.length === 0) {
      setStagedDefense({});
      return;
    }
    const liveKeys = new Set(currentAttackCards.map((c) => `${c.suit}:${c.rank}`));
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
  }, [
    Array.from(gameState?.activeAttackCards || [])
      .filter((c): c is SharedCard => c !== undefined)
      .map((c) => `${c.suit}:${c.rank}`)
      .join('|'),
  ]);

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
    navigator.clipboard.writeText(logStr).then(() => alert(t('messages.logCopied')));
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
    const isRankedLobby = !gameState.isPrivate;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col overflow-hidden safe-p"
        style={{
          color: '#f5ead0',
          background: isRankedLobby
            ? 'radial-gradient(ellipse at 50% 0%, #2a1a00 0%, #150c00 45%, #04150e 100%)'
            : 'radial-gradient(ellipse at 50% 0%, #135c3f 0%, #0a3624 38%, #04150e 100%)',
        }}
      >
        {/* Ambient glow */}
        {isRankedLobby && (
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              boxShadow: 'inset 0 0 120px rgba(212,175,55,0.12)',
              animation: 'pulse 3.5s ease-in-out infinite',
            }}
          />
        )}
        {/* ── Dev Tools (waiting phase) ── */}
        {isDevMode && (
          <div className="absolute top-12 right-2 bg-red-950/90 text-white p-2 rounded-xl border-2 border-red-500 shadow-2xl z-[60] flex flex-col space-y-1 backdrop-blur-md w-40 text-[10px]">
            <div className="font-bold uppercase tracking-widest border-b border-red-500/50 pb-1 text-red-300">
              {t('lobby.devTools')}
            </div>
            <button
              onClick={() => devSpawnDummies('dummy')}
              className="bg-purple-800 hover:bg-purple-700 px-2 py-1 rounded transition border border-purple-600"
            >
              {t('lobby.devDummy')}
            </button>
            <button
              onClick={() => devSpawnDummies('easy')}
              className="bg-red-800 hover:bg-red-700 px-2 py-1 rounded transition border border-red-600"
            >
              {t('lobby.devEasyBot')}
            </button>
            <button
              onClick={() => devSpawnDummies('hard')}
              className="bg-orange-800 hover:bg-orange-700 px-2 py-1 rounded transition border border-orange-600"
            >
              {t('lobby.devHardBot')}
            </button>
            <button
              onClick={devCopyLog}
              className="bg-blue-800 hover:bg-blue-700 px-2 py-1 rounded transition border border-blue-600"
            >
              {t('lobby.devCopyLog', { count: gameState.actionLog?.length || 0 })}
            </button>
          </div>
        )}
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0 relative z-10"
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(180deg, rgba(7,38,26,0.85), rgba(4,21,14,0.92))',
            borderBottom: `1px solid ${isRankedLobby ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.3)'}`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isRankedLobby ? (
              <h1
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontSize: 18,
                  fontWeight: 800,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                }}
              >
                <span style={{ fontSize: 22 }}>🏆</span>
                <span style={{ color: '#f4d774' }}>{t('lobby.ranked')}</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: '#d8c89c',
                    background: 'rgba(212,175,55,0.1)',
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(212,175,55,0.3)',
                  }}
                >
                  {gameState.mode === 'teams' ? t('lobby.teams') : t('lobby.classic')}
                </span>
              </h1>
            ) : (
              <h1
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontSize: 18,
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                  color: '#f4d774',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ opacity: 0.6, fontSize: 10 }}>◆</span>
                Durak
                <span style={{ opacity: 0.6, fontSize: 10 }}>◆</span>
              </h1>
            )}
            {isDevMode && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: '#f4d774',
                  background: 'linear-gradient(135deg, #5b1818, #2a0a0a)',
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: '1px solid #8b2121',
                  textTransform: 'uppercase',
                }}
              >
                Dev
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isRankedLobby && (
              <>
                <span
                  style={{
                    fontSize: 9,
                    color: '#d8c89c',
                    fontFamily: "'Cinzel', Georgia, serif",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    opacity: 0.75,
                  }}
                >
                  Table
                </span>
                <span
                  className="select-all cursor-pointer"
                  style={{
                    fontSize: 13,
                    fontFamily: "'Cinzel', Georgia, serif",
                    fontWeight: 700,
                    letterSpacing: 3,
                    color: '#f4d774',
                    background: 'rgba(0,0,0,0.5)',
                    padding: '4px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(212,175,55,0.4)',
                    boxShadow: 'inset 0 1px 0 rgba(212,175,55,0.1)',
                  }}
                >
                  {room.id}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Lobby body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Settings panel */}
          <div
            className="md:w-1/3 md:max-w-xs flex flex-col shrink-0 md:overflow-y-auto"
            style={{
              padding: 20,
              background: 'linear-gradient(180deg, rgba(7,38,26,0.7), rgba(4,21,14,0.85))',
              borderRight: '1px solid rgba(212,175,55,0.25)',
            }}
          >
            <h2
              style={{
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: 14,
                fontWeight: 700,
                color: '#f4d774',
                letterSpacing: 3,
                textTransform: 'uppercase',
                textAlign: 'center',
                margin: '0 0 14px',
                paddingBottom: 12,
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                borderBottom: '1px solid rgba(212,175,55,0.25)',
                position: 'relative',
              }}
            >
              {t('lobby.gameSettings')}
            </h2>
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(() => {
                const labelStyle: React.CSSProperties = {
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#d4af37',
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 6,
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                };
                const selectStyle: React.CSSProperties = {
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1.5px solid rgba(212,175,55,0.4)',
                  color: '#f5ead0',
                  fontSize: 13,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 700,
                  outline: 'none',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)',
                  appearance: 'none',
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M1 1l5 5 5-5' stroke='%23d4af37' stroke-width='2' fill='none'/></svg>\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: 32,
                  cursor: 'pointer',
                };
                const lockedStyle: React.CSSProperties = {
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(212,175,55,0.15)',
                  color: '#d8c89c',
                  fontSize: 13,
                  fontWeight: 700,
                  boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.2)',
                };
                const canEdit = room.sessionId === gameState.hostId && gameState.isPrivate;
                return (
                  <>
                    <div>
                      <label style={labelStyle}>{t('lobby.gameMode')}</label>
                      {canEdit ? (
                        <select
                          value={gameState.mode}
                          onChange={(e) => updateLobbySettings({ mode: e.target.value })}
                          style={selectStyle}
                        >
                          <option value="classic">{t('lobby.modeClassic')}</option>
                          <option value="teams">{t('lobby.modeTeams')}</option>
                        </select>
                      ) : (
                        <div style={lockedStyle}>
                          {gameState.mode === 'teams'
                            ? t('lobby.modeTeams')
                            : t('lobby.modeClassic')}
                        </div>
                      )}
                    </div>
                    {gameState.mode === 'teams' && (
                      <div>
                        <label style={labelStyle}>{t('lobby.teamSelection')}</label>
                        {canEdit ? (
                          <select
                            value={gameState.teamSelection}
                            onChange={(e) => updateLobbySettings({ teamSelection: e.target.value })}
                            style={selectStyle}
                          >
                            <option value="random">{t('lobby.randomAssignment')}</option>
                            <option value="manual">{t('lobby.manualSelection')}</option>
                          </select>
                        ) : (
                          <div style={lockedStyle}>
                            {gameState.teamSelection === 'manual'
                              ? t('lobby.manualSelection')
                              : t('lobby.randomAssignment')}
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>{t('lobby.playersAtTable')}</label>
                      {canEdit ? (
                        <select
                          value={gameState.maxPlayers}
                          onChange={(e) =>
                            updateLobbySettings({ maxPlayers: parseInt(e.target.value) })
                          }
                          style={selectStyle}
                        >
                          {[2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {t('lobby.nPlayers', { count: n })}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={lockedStyle}>
                          {t('lobby.nPlayers', { count: gameState.maxPlayers })}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>{t('lobby.cardsInHand')}</label>
                      {canEdit ? (
                        <select
                          value={gameState.targetHandSize}
                          onChange={(e) =>
                            updateLobbySettings({ targetHandSize: parseInt(e.target.value) })
                          }
                          style={selectStyle}
                        >
                          {[5, 7].map((n) => (
                            <option key={n} value={n}>
                              {t('lobby.nCards', { count: n })}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={lockedStyle}>
                          {t('lobby.nCards', { count: gameState.targetHandSize })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {isDevMode && (
                <div className="mt-4 pt-4 border-t border-orange-500/35 space-y-2 shrink-0">
                  <h3 className="text-[11px] font-black text-orange-300 uppercase tracking-wider border-b border-orange-500/25 pb-1.5">
                    Developer
                  </h3>
                  <p className="text-[9px] text-gray-500 leading-snug">{t('lobby.devNote')}</p>
                  <button
                    type="button"
                    onClick={() => devSpawnDummies('dummy')}
                    disabled={!isHost || gameState.players.size >= gameState.maxPlayers}
                    className="w-full bg-purple-900/55 hover:bg-purple-800/70 disabled:opacity-40 disabled:cursor-not-allowed text-purple-50 text-xs font-bold py-2 px-3 rounded-lg border border-purple-500/40 transition"
                  >
                    {t('lobby.devDummy')}
                  </button>
                  <button
                    type="button"
                    onClick={() => devSpawnDummies('easy')}
                    disabled={!isHost || gameState.players.size >= gameState.maxPlayers}
                    className="w-full bg-orange-900/55 hover:bg-orange-800/70 disabled:opacity-40 disabled:cursor-not-allowed text-orange-50 text-xs font-bold py-2 px-3 rounded-lg border border-orange-500/40 transition"
                  >
                    {t('lobby.devEasyBot')}
                  </button>
                  <button
                    type="button"
                    onClick={() => devSpawnDummies('hard')}
                    disabled={!isHost || gameState.players.size >= gameState.maxPlayers}
                    className="w-full bg-red-900/55 hover:bg-red-800/70 disabled:opacity-40 disabled:cursor-not-allowed text-red-50 text-xs font-bold py-2 px-3 rounded-lg border border-red-500/40 transition"
                  >
                    {t('lobby.devHardBot')}
                  </button>
                  <button
                    type="button"
                    onClick={devCopyLog}
                    className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-3 rounded-lg border border-slate-500/35 transition"
                  >
                    {t('lobby.devCopyLog', { count: gameState.actionLog?.length || 0 })}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Players panel */}
          <div className="flex-1 flex flex-col p-5 relative overflow-hidden">
            <div
              className="flex items-center mb-4 shrink-0"
              style={{
                paddingBottom: 12,
                borderBottom: '1px solid rgba(212,175,55,0.3)',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#f4d774',
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
              >
                {t('lobby.title')}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#1a1308',
                    background: 'linear-gradient(135deg, #f4d774, #d4af37 60%, #8b6914)',
                    padding: '3px 12px',
                    borderRadius: 999,
                    letterSpacing: 1,
                    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                    boxShadow: '0 0 14px rgba(212,175,55,0.4)',
                  }}
                >
                  {gameState.players.size}/{gameState.maxPlayers}
                </span>
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {Array.from(gameState.players.entries()).map(([id, p]) => {
                  const isMe = id === room.sessionId;
                  const isHostP = id === gameState.hostId;
                  return (
                    <div
                      key={id}
                      className="flex items-center transition-all"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: isMe
                          ? 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(139,105,20,0.08))'
                          : 'linear-gradient(180deg, rgba(7,38,26,0.6), rgba(4,21,14,0.85))',
                        border: isMe
                          ? '1.5px solid rgba(212,175,55,0.6)'
                          : '1px solid rgba(212,175,55,0.15)',
                        boxShadow: isMe
                          ? '0 0 18px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                          : '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                      }}
                    >
                      <div
                        style={{
                          padding: 2,
                          borderRadius: '50%',
                          background: isHostP
                            ? 'linear-gradient(135deg, #f4d774, #d4af37 60%, #8b6914)'
                            : 'linear-gradient(135deg, rgba(212,175,55,0.4), rgba(139,105,20,0.4))',
                        }}
                      >
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.username || id}
                            className="w-9 h-9 rounded-full"
                            style={{ display: 'block' }}
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{
                              background: 'linear-gradient(180deg, #07261a, #04150e)',
                              color: '#d8c89c',
                              fontFamily: "'Cinzel', Georgia, serif",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {(p.username || id).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="ml-3 flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span
                            className="truncate"
                            style={{
                              fontFamily: "'Cinzel', Georgia, serif",
                              fontSize: 13,
                              fontWeight: 700,
                              color: isMe ? '#f4d774' : '#f5ead0',
                              letterSpacing: 0.5,
                              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                            }}
                          >
                            {p.username || id.slice(0, 8)}
                          </span>
                          {p.isPremium && (
                            <span
                              style={{
                                fontSize: 12,
                                lineHeight: 1,
                                filter: 'drop-shadow(0 0 6px rgba(192,132,252,0.8))',
                              }}
                              title="Premium member"
                            >
                              ♛
                            </span>
                          )}
                          {isHostP && (
                            <span
                              style={{
                                fontSize: 8,
                                fontWeight: 800,
                                color: '#1a1308',
                                background:
                                  'linear-gradient(135deg, #f4d774, #d4af37 60%, #8b6914)',
                                padding: '2px 7px',
                                borderRadius: 4,
                                letterSpacing: 1.5,
                                textTransform: 'uppercase',
                                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                              }}
                            >
                              {t('lobby.host')}
                            </span>
                          )}
                          {isMe && !isHostP && (
                            <span
                              style={{
                                fontSize: 8,
                                fontWeight: 800,
                                color: '#d8c89c',
                                background: 'rgba(212,175,55,0.15)',
                                border: '1px solid rgba(212,175,55,0.3)',
                                padding: '2px 7px',
                                borderRadius: 4,
                                letterSpacing: 1.5,
                                textTransform: 'uppercase',
                              }}
                            >
                              {t('lobby.you')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        {p.isReady ? (
                          <span
                            style={{
                              fontSize: 9,
                              fontFamily: "'Cinzel', Georgia, serif",
                              fontWeight: 700,
                              color: '#1a1308',
                              background: 'linear-gradient(135deg, #f4d774, #d4af37 60%, #8b6914)',
                              padding: '4px 12px',
                              borderRadius: 999,
                              letterSpacing: 1.5,
                              textTransform: 'uppercase',
                              boxShadow: '0 0 12px rgba(212,175,55,0.45)',
                              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                            }}
                          >
                            {t('lobby.statusReady')}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 9,
                              fontFamily: "'Cinzel', Georgia, serif",
                              fontWeight: 700,
                              color: '#d8c89c',
                              background: 'rgba(0,0,0,0.35)',
                              border: '1px solid rgba(212,175,55,0.18)',
                              padding: '4px 12px',
                              borderRadius: 999,
                              letterSpacing: 1.5,
                              textTransform: 'uppercase',
                              opacity: 0.85,
                            }}
                          >
                            {t('lobby.statusWaiting')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
            <div
              className="shrink-0 mt-3"
              style={{
                paddingTop: 16,
                borderTop: '1px solid rgba(212,175,55,0.25)',
              }}
            >
              {(() => {
                const goldBtn: React.CSSProperties = {
                  padding: '14px 22px',
                  borderRadius: 14,
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, #f4d774 0%, #d4af37 50%, #8b6914 100%)',
                  color: '#1a1308',
                  border: '1.5px solid rgba(212,175,55,0.7)',
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                  boxShadow: '0 10px 24px rgba(0,0,0,0.5), 0 0 22px rgba(212,175,55,0.4)',
                  cursor: 'pointer',
                };
                const ghostBtn: React.CSSProperties = {
                  padding: '12px 18px',
                  borderRadius: 14,
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  background: 'rgba(212,175,55,0.08)',
                  color: '#d8c89c',
                  border: '1.5px solid rgba(212,175,55,0.35)',
                  cursor: 'pointer',
                };
                const readyChip: React.CSSProperties = {
                  padding: '12px 18px',
                  borderRadius: 14,
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, #1e7c4a, #0a3624)',
                  color: '#f5ead0',
                  border: '1.5px solid #2f9e5d',
                  cursor: 'pointer',
                };
                const disabledBtn: React.CSSProperties = {
                  ...goldBtn,
                  background: 'rgba(0,0,0,0.35)',
                  color: '#d8c89c',
                  border: '1.5px solid rgba(212,175,55,0.2)',
                  textShadow: 'none',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  cursor: 'not-allowed',
                  opacity: 0.6,
                };
                if (viewAsSpectator) {
                  return (
                    <div
                      className="text-center"
                      style={{
                        padding: '14px 0',
                        fontFamily: "'Cinzel', Georgia, serif",
                        fontWeight: 700,
                        fontSize: 13,
                        letterSpacing: 2.5,
                        textTransform: 'uppercase',
                        color: '#d8c89c',
                      }}
                    >
                      {t('lobby.spectating')}
                    </div>
                  );
                }
                if (!gameState.isPrivate) {
                  return (
                    <div
                      className="flex items-center justify-center gap-3"
                      style={{ padding: '14px 0' }}
                    >
                      <div
                        className="animate-spin shrink-0"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: '2px solid rgba(212,175,55,0.3)',
                          borderTopColor: '#d4af37',
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "'Cinzel', Georgia, serif",
                          fontWeight: 700,
                          fontSize: 13,
                          color: '#f4d774',
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                        }}
                      >
                        {t('lobby.awaitingPlayers', {
                          count: gameState.players.size,
                          max: gameState.maxPlayers,
                        })}
                      </span>
                    </div>
                  );
                }
                if (room.sessionId === gameState.hostId) {
                  const canStart =
                    gameState.players.size >= 2 &&
                    Array.from(gameState.players.values()).every((p) => p.isReady);
                  return (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleToggleReady}
                        style={myPlayer?.isReady ? readyChip : ghostBtn}
                      >
                        {myPlayer?.isReady ? t('lobby.ready') : t('lobby.markReady')}
                      </button>
                      <button
                        onClick={startLobbyGame}
                        disabled={!canStart}
                        style={{ ...(canStart ? goldBtn : disabledBtn), flex: 1 }}
                      >
                        {t('lobby.startGame')}
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    onClick={handleToggleReady}
                    style={{
                      ...(myPlayer?.isReady ? readyChip : goldBtn),
                      width: '100%',
                      fontSize: 14,
                      padding: '14px 20px',
                    }}
                  >
                    {myPlayer?.isReady ? t('lobby.readyToPlay') : t('lobby.tapToReady')}
                  </button>
                );
              })()}
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
    <div
      className="safe-p"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: 'radial-gradient(ellipse at 50% 0%, #135c3f 0%, #0a3624 38%, #04150e 100%)',
        color: '#f5ead0',
      }}
    >
      {suhuhResult && (
        <SuhuhReveal
          draws={suhuhResult.draws}
          winnerId={suhuhResult.winnerId}
          players={gameState.players as unknown as Map<string, Player>}
          seatOrder={Array.from(gameState.seatOrder).filter((id): id is string => id != null)}
          onDone={clearSuhuhResult}
        />
      )}

      {/* ELO result and rematch are now part of the unified game-over overlay below */}

      {/* ── Game aborted overlay ── */}
      {gameAbortReason && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.86)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="flex flex-col items-center text-center"
            style={{
              gap: 18,
              padding: '28px 36px',
              borderRadius: 22,
              minWidth: 300,
              background: 'linear-gradient(180deg, rgba(10,54,36,0.95), rgba(4,21,14,0.98))',
              border: '2px solid #b13030',
              boxShadow: '0 0 60px rgba(177,48,48,0.4), 0 24px 60px rgba(0,0,0,0.85)',
            }}
          >
            <div style={{ fontSize: 48 }}>⚠</div>
            <div>
              <div
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontWeight: 900,
                  fontSize: 20,
                  color: '#ff9999',
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                }}
              >
                {t('result.gameAborted')}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#d8c89c',
                  marginTop: 8,
                  fontStyle: 'italic',
                  opacity: 0.85,
                }}
              >
                {gameAbortReason}
              </div>
            </div>
            <button
              onClick={clearGameAbortReason}
              style={{
                padding: '12px 28px',
                borderRadius: 999,
                fontFamily: "'Cinzel', Georgia, serif",
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #f4d774 0%, #d4af37 50%, #8b6914 100%)',
                border: '1.5px solid rgba(212,175,55,0.7)',
                color: '#1a1308',
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                cursor: 'pointer',
              }}
            >
              {t('result.backToMenu')}
            </button>
          </div>
        </div>
      )}

      {/* ── Info Bar ── */}
      <div
        className="shrink-0 z-20"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isShort ? '4px 14px' : '8px 14px',
          background: 'linear-gradient(180deg, rgba(7,38,26,0.92), rgba(4,21,14,0.96))',
          borderBottom: '1px solid rgba(212,175,55,0.35)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
          {isMyTurn && settings.showTimer && (
            <motion.div
              animate={shouldShake ? { x: [0, -2, 2, -2, 0] } : { x: 0 }}
              transition={shouldShake ? { duration: 0.3, repeat: Infinity } : { duration: 0 }}
              className={`font-bold tabular-nums ${getTimerColor()}`}
              style={{
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: 14,
                letterSpacing: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              ⏳ {(timeRemaining / 1000).toFixed(1)}s
            </motion.div>
          )}
          <span style={{ color: '#d8c89c', display: 'flex', alignItems: 'center', gap: 4 }}>
            🂠
            <span
              style={{ color: '#f4d774', fontWeight: 800, fontFamily: "'Cinzel', Georgia, serif" }}
            >
              {gameState.deck?.length || 0}
            </span>
          </span>
          {gameState.huzurCard && (
            <span
              title={`Trump: ${gameState.huzurSuit}`}
              style={{
                display: 'inline-flex',
                borderRadius: 4,
                padding: 1,
                background: 'linear-gradient(135deg, #f4d774 0%, #d4af37 45%, #8b6914 100%)',
                boxShadow: '0 0 8px rgba(212,175,55,0.45)',
              }}
            >
              <PlayingCard
                suit={gameState.huzurCard.suit}
                rank={gameState.huzurCard.rank}
                width={22}
              />
              <span className="sr-only">{gameState.huzurSuit}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {gameState.mode === 'teams' && !viewAsSpectator && myPlayer && (
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${myTeamBadge}`}>
              {myTeamLabel}
            </div>
          )}
          {viewAsSpectator && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "'Cinzel', Georgia, serif",
                fontWeight: 700,
                letterSpacing: 2,
                color: '#f5ead0',
                background: 'linear-gradient(135deg, #5b1818, #2a0a0a)',
                border: '1px solid #8b2121',
                padding: '3px 10px',
                borderRadius: 999,
                textTransform: 'uppercase',
              }}
            >
              👁 Spectating
            </span>
          )}
          {!viewAsSpectator && isMyTurn && (
            <span
              className="animate-pulse"
              style={{
                fontSize: 10,
                fontFamily: "'Cinzel', Georgia, serif",
                fontWeight: 800,
                letterSpacing: 2,
                color: '#1a1308',
                background: 'linear-gradient(135deg, #f4d774, #d4af37 60%, #8b6914)',
                padding: '3px 12px',
                borderRadius: 999,
                textTransform: 'uppercase',
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                boxShadow: '0 0 14px rgba(212,175,55,0.55)',
              }}
            >
              {t('messages.yourTurn')}
            </span>
          )}
          {(gameState.spectatorCount ?? 0) > 0 && (
            <span style={{ fontSize: 10, color: '#d8c89c' }}>👁 {gameState.spectatorCount}</span>
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
            className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center max-w-[90%]"
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b2121, #2a0a0a)',
              border: '1px solid #b13030',
              color: '#f5ead0',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Inter', system-ui, sans-serif",
              boxShadow: '0 12px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <span>{gameMessage}</span>
            <button
              onClick={clearGameMessage}
              aria-label="Dismiss message"
              style={{
                marginLeft: 14,
                background: 'transparent',
                border: 'none',
                color: '#f5ead0',
                opacity: 0.7,
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              ✕
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
            {t('lobby.devCopyLog', { count: gameState.actionLog?.length || 0 })}
          </button>
        </div>
      )}

      {/* ── Oval Table Area ── */}
      <div className="flex-1 relative min-h-0">
        {/* Oval felt surface — also the drop zone for drag-to-play */}
        <div
          ref={dropZoneRef}
          className="absolute inset-3 md:inset-8 rounded-[50%] transition-colors duration-150"
          style={{
            background: 'radial-gradient(ellipse at center, #135c3f 0%, #0a3624 55%, #04150e 100%)',
            border: `3px solid ${
              draggingCardKey
                ? isOverDropZone
                  ? '#f4d774'
                  : 'rgba(212,175,55,0.7)'
                : 'rgba(212,175,55,0.45)'
            }`,
            boxShadow:
              draggingCardKey && isOverDropZone
                ? 'inset 0 0 90px rgba(212,175,55,0.35), inset 0 0 0 1px rgba(212,175,55,0.6), 0 0 30px rgba(212,175,55,0.25)'
                : 'inset 0 0 80px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(212,175,55,0.18), 0 8px 24px rgba(0,0,0,0.55)',
          }}
        >

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
                                  className="absolute left-3 top-3"
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
                            className="absolute left-3 top-3"
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
                className="flex flex-col items-center transition-all"
                style={{
                  padding: '6px 8px',
                  borderRadius: 14,
                  background: isPlaying
                    ? 'linear-gradient(180deg, rgba(212,175,55,0.18), rgba(139,105,20,0.12))'
                    : 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
                  border: isPlaying ? '1.5px solid #d4af37' : '1px solid rgba(212,175,55,0.18)',
                  boxShadow: isPlaying
                    ? '0 0 20px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
                    : '0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <div
                  style={{
                    padding: 2,
                    borderRadius: '50%',
                    background: isPlaying
                      ? 'linear-gradient(135deg, #f4d774, #d4af37 50%, #8b6914)'
                      : 'linear-gradient(135deg, rgba(212,175,55,0.5), rgba(139,105,20,0.5))',
                  }}
                >
                  {player.avatarUrl ? (
                    <img
                      src={player.avatarUrl}
                      alt={player.username || id}
                      className="w-7 h-7 md:w-9 md:h-9 rounded-full"
                      style={{ display: 'block' }}
                    />
                  ) : (
                    <div
                      className="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(180deg, #07261a, #04150e)',
                        color: '#d8c89c',
                        fontFamily: "'Cinzel', Georgia, serif",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {(player.username || id).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span
                  className="truncate max-w-[60px] md:max-w-[110px]"
                  style={{
                    marginTop: 4,
                    fontFamily: "'Cinzel', Georgia, serif",
                    fontSize: 10,
                    fontWeight: 700,
                    color: isPlaying ? '#f4d774' : '#d8c89c',
                    letterSpacing: 0.5,
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                  }}
                >
                  {player.username || id.slice(0, 6)}
                </span>
                <span
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#1b150a',
                    background: 'linear-gradient(180deg, #f4d774, #d4af37)',
                    border: '1px solid rgba(139,105,20,0.7)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    padding: '1px 9px',
                    borderRadius: 999,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  🃏{player.hand.length}
                </span>
                {gameState.mode === 'teams' && (
                  <span
                    style={{
                      marginTop: 3,
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: 1,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        player.team === 0
                          ? 'linear-gradient(135deg, #1e3a8a, #0a1a4a)'
                          : 'linear-gradient(135deg, #8b2121, #2a0a0a)',
                      color: player.team === 0 ? '#dbeafe' : '#fde2e2',
                      border: player.team === 0 ? '1px solid #3b82f6' : '1px solid #b13030',
                    }}
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
        <div
          className="flex flex-wrap justify-center gap-2 shrink-0 z-20 touch-manipulation"
          style={{ padding: isShort ? '2px 10px 2px' : '6px 10px 4px' }}
        >
          {(() => {
            const btnBase: React.CSSProperties = {
              padding: isShort ? '6px 16px' : '9px 22px',
              borderRadius: 999,
              fontFamily: "'Cinzel', Georgia, serif",
              fontSize: isShort ? 11 : 13,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'transform 0.05s, opacity 0.15s',
              boxShadow: '0 8px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            };
            const gold: React.CSSProperties = {
              ...btnBase,
              background: 'linear-gradient(135deg, #f4d774 0%, #d4af37 50%, #8b6914 100%)',
              color: '#1a1308',
              border: '1.5px solid rgba(212,175,55,0.7)',
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            };
            const burgundy: React.CSSProperties = {
              ...btnBase,
              background: 'linear-gradient(135deg, #b13030, #5b1818)',
              color: '#f5ead0',
              border: '1.5px solid #8b2121',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            };
            const emerald: React.CSSProperties = {
              ...btnBase,
              background: 'linear-gradient(135deg, #1e7c4a, #0a3624)',
              color: '#f5ead0',
              border: '1.5px solid #2f9e5d',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            };
            const slate: React.CSSProperties = {
              ...btnBase,
              background: 'linear-gradient(180deg, rgba(7,38,26,0.7), rgba(4,21,14,0.85))',
              color: '#d8c89c',
              border: '1px solid rgba(212,175,55,0.25)',
            };
            return (
              <>
                {isMyTurn && attackCards.length === 0 && (
                  <button
                    onClick={handleAttack}
                    disabled={selectedCards.length === 0}
                    style={{
                      ...burgundy,
                      opacity: selectedCards.length === 0 ? 0.4 : 1,
                      cursor: selectedCards.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ⚔ Attack ({selectedCards.length})
                  </button>
                )}
                {isMyTurn &&
                  attackCards.length > 0 &&
                  (() => {
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
                              style={{
                                ...emerald,
                                opacity: allStaged ? 1 : 0.4,
                                cursor: allStaged ? 'pointer' : 'not-allowed',
                              }}
                            >
                              ✓ Confirm ({stagedCount}/{needCount})
                            </button>
                            <button onClick={clearStagedDefense} style={slate}>
                              Clear
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleDefend}
                            disabled={selectedCards.length === 0}
                            style={{
                              ...emerald,
                              opacity: selectedCards.length === 0 ? 0.4 : 1,
                              cursor: selectedCards.length === 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            🛡 Defend ({selectedCards.length})
                          </button>
                        )}
                        <button onClick={handlePickUp} style={gold}>
                          Pick Up
                        </button>
                      </>
                    );
                  })()}
                {(gameState.deck?.length || 0) > 0 &&
                  gameState.huzurCard &&
                  (gameState.huzurCard.isJoker
                    ? myHand.some((c) => c.suit === 'Spades' && c.rank === 16) &&
                      !myPlayer?.pickedUpCardKeys.includes('Spades:16:0') && (
                        <button onClick={handleSwapHuzur} style={{ ...slate, color: '#f4d774' }}>
                          ♛ Swap Ace
                        </button>
                      )
                    : myHand.some((c) => c.suit === gameState.huzurSuit && c.rank === 7) &&
                      !myPlayer?.pickedUpCardKeys.includes(`${gameState.huzurSuit}:7:0`) && (
                        <button onClick={handleSwapHuzur} style={{ ...slate, color: '#f4d774' }}>
                          ♛ Swap 7
                        </button>
                      ))}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Player Hand ── */}
      {!viewAsSpectator && (
        <div
          className={`shrink-0 transition-all duration-300 ${
            draggingCardKey ? 'overflow-visible' : 'overflow-hidden'
          } ${isShort ? (isMyTurn ? 'pb-1 pt-0.5' : 'pb-0.5 pt-0') : (isMyTurn ? 'pb-2 pt-1' : 'pb-1 pt-0.5')}`}
          style={{
            background:
              'linear-gradient(180deg, rgba(4,21,14,0.45) 0%, rgba(4,21,14,0.85) 60%, rgba(4,21,14,0.95) 100%)',
            borderTop: '1px solid rgba(212,175,55,0.3)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,175,55,0.08)',
          }}
        >
          <div
            className={`flex flex-row items-end md:justify-center w-full px-1 md:px-4 custom-scrollbar ${
              draggingCardKey ? 'overflow-visible' : 'overflow-x-auto md:overflow-x-visible'
            }`}
            style={{ minHeight: isShort ? (isMyTurn ? '60px' : '48px') : (isMyTurn ? '80px' : '64px') }}
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
            <div
              className="mt-12 flex items-center gap-3 backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, #3b2700, #1c1000)',
                border: '1.5px solid #d4af37',
                color: '#f4d774',
                padding: '12px 20px',
                borderRadius: 14,
                boxShadow: '0 14px 32px rgba(0,0,0,0.6), 0 0 24px rgba(212,175,55,0.35)',
                fontFamily: "'Cinzel', Georgia, serif",
              }}
            >
              <div
                className="animate-spin shrink-0"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid rgba(212,175,55,0.3)',
                  borderTopColor: '#d4af37',
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {t('messages.connectionLost')}
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
            <div
              className="mb-20 flex items-center gap-3 backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(7,38,26,0.95), rgba(4,21,14,0.98))',
                border: '1px solid rgba(212,175,55,0.4)',
                color: '#f5ead0',
                padding: '10px 18px',
                borderRadius: 14,
                boxShadow: '0 12px 30px rgba(0,0,0,0.55)',
              }}
            >
              <div
                className="animate-spin shrink-0"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid rgba(212,175,55,0.3)',
                  borderTopColor: '#d4af37',
                }}
              />
              <span style={{ fontSize: 13 }}>
                {t('messages.opponentDisconnected', { name: disconnectedOpponent })}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game Over Overlay ── */}
      {gameState.phase === 'finished' && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center safe-p"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        >
          {(() => {
            const isLoser = !!gameState.loser && gameState.loser === room.sessionId;
            const isDraw = !gameState.loser; // loser is '' when everyone finished simultaneously
            const isWinner = !isLoser && !isDraw;
            const accent = isLoser ? '#b13030' : isDraw ? '#3b82f6' : '#d4af37';
            const icon = isLoser ? '🥴' : isDraw ? '🤝' : '👑';
            const title = isLoser
              ? t('result.youAreDurak')
              : isDraw
                ? t('result.draw')
                : t('result.youSurvived');
            // Determine whose loser name to show
            const loserName =
              gameState.players.get(gameState.loser ?? '')?.username ??
              gameState.loser?.slice(0, 8);

            const deltaColor = eloResult
              ? eloResult.delta >= 0
                ? '#f4d774'
                : '#ff7a7a'
              : '#f4d774';

            return (
              <div
                className="text-center"
                style={{
                  width: '92%',
                  maxWidth: 400,
                  borderRadius: 22,
                  background:
                    'linear-gradient(180deg, rgba(10,54,36,0.97) 0%, rgba(7,38,26,0.97) 60%, rgba(4,21,14,0.99) 100%)',
                  border: `2px solid ${accent}`,
                  boxShadow: `0 0 80px ${accent}44, 0 24px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Ornate inner frame */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 6,
                    borderRadius: 17,
                    border: '1px solid rgba(212,175,55,0.3)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Result section */}
                <div style={{ padding: '28px 28px 20px' }}>
                  <div style={{ fontSize: 58, lineHeight: 1, marginBottom: 12 }} aria-hidden>
                    {icon}
                  </div>
                  <h2
                    id="game-over-title"
                    style={{
                      fontFamily: "'Cinzel', Georgia, serif",
                      fontSize: 26,
                      fontWeight: 900,
                      letterSpacing: 3,
                      textTransform: 'uppercase',
                      color: isWinner ? '#f4d774' : isLoser ? '#ff7a7a' : '#bfdbfe',
                      textShadow: `0 2px 12px ${accent}66`,
                      margin: '0 0 6px',
                    }}
                  >
                    {title}
                  </h2>
                  <p
                    style={{
                      color: '#d8c89c',
                      fontSize: 12,
                      opacity: 0.8,
                      margin: 0,
                      fontStyle: 'italic',
                    }}
                  >
                    {isDraw
                      ? t('result.messageDraw')
                      : isLoser
                        ? t('result.messageLost')
                        : t('result.messageWon', { loser: loserName })}
                  </p>
                </div>

                {/* ELO change (ranked games only) */}
                {eloResult && (
                  <div
                    style={{
                      margin: '0 20px',
                      padding: '14px 20px',
                      borderRadius: 12,
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(212,175,55,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Cinzel', Georgia, serif",
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#d8c89c',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        opacity: 0.7,
                      }}
                    >
                      {t('result.rankedElo')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontFamily: "'Cinzel', Georgia, serif",
                          fontSize: 13,
                          color: '#d8c89c',
                          opacity: 0.6,
                        }}
                      >
                        {eloResult.oldElo}
                      </span>
                      <span style={{ color: '#d8c89c', opacity: 0.4, fontSize: 11 }}>→</span>
                      <span
                        style={{
                          fontFamily: "'Cinzel', Georgia, serif",
                          fontSize: 15,
                          fontWeight: 900,
                          color: '#f4d774',
                        }}
                      >
                        {eloResult.newElo}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Cinzel', Georgia, serif",
                          fontSize: 16,
                          fontWeight: 900,
                          color: deltaColor,
                          textShadow: `0 0 12px ${deltaColor}66`,
                          minWidth: 44,
                          textAlign: 'right',
                        }}
                      >
                        {eloResult.delta >= 0 ? '+' : ''}
                        {eloResult.delta}
                      </span>
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    margin: '20px 28px 16px',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: `linear-gradient(90deg, transparent, rgba(212,175,55,0.3))`,
                    }}
                  />
                  <span style={{ color: 'rgba(212,175,55,0.4)', fontSize: 9 }}>◆</span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: `linear-gradient(90deg, rgba(212,175,55,0.3), transparent)`,
                    }}
                  />
                </div>

                {/* Rematch voting status */}
                {rematchState && (
                  <div
                    style={{
                      margin: '0 20px 14px',
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: 'rgba(212,175,55,0.08)',
                      border: '1px solid rgba(212,175,55,0.2)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Cinzel', Georgia, serif",
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#f4d774',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('result.rematchVotes', {
                        votes: rematchState.votes,
                        needed: rematchState.needed,
                      })}
                    </div>
                    {rematchState.voters.length > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#d8c89c',
                          marginTop: 4,
                          opacity: 0.7,
                          fontStyle: 'italic',
                        }}
                      >
                        {rematchState.voters.join(', ')} ✓
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '0 20px 24px',
                  }}
                >
                  {!isSpectator &&
                    (hasVotedRematch ? (
                      <div
                        style={{
                          flex: 1,
                          padding: '13px 0',
                          borderRadius: 14,
                          background: 'rgba(212,175,55,0.08)',
                          border: '1px solid rgba(212,175,55,0.2)',
                          fontFamily: "'Cinzel', Georgia, serif",
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#f4d774',
                          letterSpacing: 1.5,
                          textTransform: 'uppercase',
                          textAlign: 'center',
                        }}
                      >
                        {t('result.rematchWaiting')}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setHasVotedRematch(true);
                          sendRematchVote(true);
                        }}
                        style={{
                          flex: 1,
                          padding: '13px 0',
                          borderRadius: 14,
                          fontFamily: "'Cinzel', Georgia, serif",
                          fontWeight: 800,
                          fontSize: 13,
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          background:
                            'linear-gradient(135deg, #f4d774 0%, #d4af37 50%, #8b6914 100%)',
                          border: '1.5px solid rgba(212,175,55,0.7)',
                          color: '#1a1308',
                          textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                          boxShadow: '0 6px 18px rgba(0,0,0,0.45), 0 0 18px rgba(212,175,55,0.35)',
                          transition: 'transform 0.05s',
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                        onMouseUp={(e) => (e.currentTarget.style.transform = '')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
                      >
                        {t('result.rematch')}
                      </button>
                    ))}
                  <button
                    onClick={() => {
                      if (settings.confirmLeave && !window.confirm(t('common:errors.leaveGame'))) return;
                      leaveGame();
                    }}
                    style={{
                      flex: isSpectator ? 1 : undefined,
                      padding: '13px 20px',
                      borderRadius: 14,
                      fontFamily: "'Cinzel', Georgia, serif",
                      fontWeight: 800,
                      fontSize: 13,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, #2a2018, #1a140e)',
                      border: '1.5px solid rgba(212,175,55,0.25)',
                      color: '#d8c89c',
                      transition: 'transform 0.05s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.55)')
                    }
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)';
                      e.currentTarget.style.transform = '';
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = '')}
                  >
                    {t('result.leave')}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
