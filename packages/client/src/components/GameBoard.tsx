import React, { useMemo, useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { Card as UICard } from './Card';
import { Card as SharedCard, Player } from '@durak/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudio } from '../utils/audio';

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
    defenseSnapshot,
    serverTimeOffset,
    updateLobbySettings,
    startLobbyGame,
  } = useGame();
  const [selectedCards, setSelectedCards] = useState<SharedCard[]>([]);
  const [devSelectedCards, setDevSelectedCards] = useState<Record<string, SharedCard[]>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const { playDealSound } = useAudio();

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

  // Issue #80: drive time-based visibility without calling Date.now() during render
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const defenseVisible = !!defenseSnapshot && now - defenseSnapshot.at < 10000;

  const { teamBlueCount, teamRedCount } = useMemo(() => {
    // Avoid throwing when we haven't joined a room / state not yet present.
    if (!gameState) return { teamBlueCount: 0, teamRedCount: 0 };

    const allPlayers = Array.from(gameState.players.values());
    const teamBlueCount = allPlayers.filter((p) => p.team === 0).length;
    const teamRedCount = allPlayers.filter((p) => p.team === 1).length;
    return { teamBlueCount, teamRedCount };
  }, [gameState]);

  if (!room || !gameState) {
    return null;
  }

  const isMyTurn = gameState.currentTurn === room.sessionId;
  const myPlayer = gameState.players.get(room.sessionId);
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
      room.send('attack', { cards: selectedCards });
      setSelectedCards([]);
    }
  };

  const handleDefend = () => {
    if (selectedCards.length > 0) {
      room.send('defend', { cards: selectedCards });
      setSelectedCards([]);
    }
  };

  const handlePickUp = () => {
    room.send('pickUp');
  };

  const handleTeamSelect = (teamId: number) => {
    room.send('switchTeam', { team: teamId });
  };

  const handleToggleReady = () => {
    const isReadyNow = !myPlayer?.isReady;
    room.send('toggleReady', { isReady: isReadyNow });
  };

  const handleSwapHuzur = () => {
    room.send('swapHuzur');
  };

  const isDevMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('dev') === 'true';

  const devSpawnDummies = () => room.send('dev_action', { action: 'spawn_dummies' });
  const devForcePass = () => room.send('dev_action', { action: 'force_pass' });
  const devCopyLog = () => {
    const logStr = Array.from(gameState.actionLog || []).join('\n');
    navigator.clipboard.writeText(logStr).then(() => alert('Game Log Copied to Clipboard!'));
  };
  const handleDevCardClick = (oppId: string, card: SharedCard) => {
    if (!isDevMode) return;
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

  return (
    <div className="flex flex-col md:grid md:grid-rows-[auto_1fr_auto] h-[100dvh] md:h-[95vh] w-full max-w-7xl mx-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 md:rounded-2xl md:ring-4 md:ring-green-900/50 md:shadow-2xl overflow-y-auto md:overflow-hidden p-3 md:p-6 gap-3 md:gap-6 relative text-white">
      {/* Top Banner (Header) & Opponents */}
      <div className="flex flex-col space-y-3 md:space-y-6 flex-shrink-0">
        {/* Banner */}
        <div className="flex items-center justify-between bg-black/40 px-4 md:px-6 py-2 md:py-4 rounded-xl shadow-md border border-white/10 w-full z-10 flex-wrap gap-2 md:gap-4">
          <div className="flex items-center space-x-3 md:space-x-6 text-xs md:text-sm flex-wrap gap-1 md:gap-2">
            <div>
              <span className="text-gray-400">Phase:</span>{' '}
              <span className="font-bold">{gameState.phase}</span>
            </div>
            <div>
              <span className="text-gray-400">Turn:</span>{' '}
              <span className={`font-bold ${isMyTurn ? 'text-yellow-400' : 'text-white'}`}>
                {isMyTurn ? 'Yours' : 'Opps'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Deck:</span>{' '}
              <span className="font-bold">{gameState.deck?.length || 0}</span>
            </div>
          </div>
          {gameState.mode === 'teams' && (
            <div
              className={`px-2 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold shadow-md ${myTeamBadge}`}
            >
              Team: {myTeamLabel}
            </div>
          )}
        </div>

        {/* Game Message */}
        <AnimatePresence>
          {gameMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-600 border border-red-400 font-bold text-white px-4 py-2 md:px-6 md:py-3 rounded-lg shadow-2xl flex items-center justify-between mx-auto w-full max-w-md z-50 absolute top-16 md:top-20 left-1/2 -translate-x-1/2 text-sm md:text-base"
            >
              <span>{gameMessage}</span>
              <button onClick={clearGameMessage} className="text-red-200 hover:text-white ml-4">
                &times;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opponents Flex Container */}
        <div className="flex flex-row overflow-x-auto md:flex-wrap md:justify-center gap-2 md:gap-4 z-10 pb-2 md:pb-0 custom-scrollbar">
          {(() => {
            const seatOrder = Array.from(gameState.seatOrder);
            let opponents: { id: string; player: Player }[] = [];

            if (seatOrder.length > 0) {
              // Game started: order opponents circularly starting from the player to their left
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
              // Waiting phase: Just list other players, maybe sorted by team
              opponents = Array.from(gameState.players.entries())
                .filter(([id]) => id !== room.sessionId)
                .map(([id, player]) => ({ id, player }))
                .sort((a, b) => (a.player.team || 0) - (b.player.team || 0));
            }

            return opponents.map(({ id, player }) => {
              const isPlaying = gameState.currentTurn === id;
              return (
                <div
                  key={id}
                  className={`bg-black/40 px-3 py-2 md:px-6 md:py-4 rounded-xl text-center flex flex-col items-center relative border shadow-lg flex-shrink-0 transition-all duration-300 ${gameState.phase === 'waiting' && player.isReady ? 'border-green-500' : isPlaying ? 'border-yellow-400 ring-4 ring-yellow-400/50 scale-105 shadow-[0_0_30px_rgba(250,204,21,0.6)] z-30 bg-yellow-900/20' : 'border-white/10 opacity-80'} ${isDevMode ? 'w-auto min-w-[180px] md:min-w-[220px]' : 'min-w-[100px] md:sm:w-48'}`}
                >
                  {isPlaying && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-[10px] md:text-xs font-extrabold px-3 py-1 md:px-4 md:py-1.5 rounded-full shadow-lg animate-bounce whitespace-nowrap z-20 uppercase tracking-widest border border-yellow-200">
                      Active Turn
                    </div>
                  )}
                  {gameState.phase === 'waiting' && player.isReady && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-green-900 text-[8px] md:text-[9px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-full shadow-md whitespace-nowrap z-20">
                      READY
                    </div>
                  )}
                  {/* Team badge */}
                  {gameState.mode === 'teams' && (
                    <div
                      className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[8px] md:text-[9px] font-extrabold shadow border whitespace-nowrap z-20 ${player.team === 0 ? 'bg-blue-700 text-blue-100 border-blue-300/30' : 'bg-red-700 text-red-100 border-red-300/30'}`}
                    >
                      {player.team === 0 ? 'BLUE' : 'RED'}
                    </div>
                  )}

                  <div className="flex flex-col items-center mb-2 md:mb-3">
                    {player.avatarUrl && (
                      <img
                        src={player.avatarUrl}
                        alt={player.username || id}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full shadow-md border-2 border-black/50 mb-1"
                      />
                    )}
                    <div
                      className="text-[10px] md:text-xs text-gray-200 font-bold bg-green-900/60 border border-green-700/80 px-2 py-1 md:px-3 md:py-1 rounded max-w-[100px] md:max-w-[140px] shadow-inner"
                      title={player.username || id}
                    >
                      <span className="block truncate">{player.username || id.slice(0, 8)}</span>
                    </div>
                  </div>

                  {/* Draw Log for Developer Mode / Ground Tracking */}
                  {player.lastDrawLog && player.lastDrawLog.length > 0 && (
                    <div className="mb-2 w-full bg-black/50 rounded p-1.5 border border-white/5 animate-pulse">
                      <div className="text-[8px] uppercase tracking-tighter text-gray-500 mb-1">
                        Last from ground:
                      </div>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {Array.from(player.lastDrawLog).map((cardStr, idx) => (
                          <span
                            key={idx}
                            className="bg-yellow-900/40 text-yellow-400 text-[9px] px-1 rounded border border-yellow-700/30 font-bold"
                          >
                            {cardStr}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-1 md:mt-2 text-lg md:text-xl font-bold text-white flex flex-col items-center justify-center bg-black/30 px-3 py-1.5 md:px-4 md:py-2 rounded-lg leading-none w-full ${isDevMode ? 'py-4 gap-4' : 'flex-row space-x-1 md:space-x-2'}`}
                  >
                    {isDevMode ? (
                      <>
                        <div className="flex flex-row justify-center -space-x-8 scale-75 md:scale-90 origin-top min-h-[100px] pt-2">
                          {Array.from(player.hand)
                            .filter((c): c is SharedCard => c !== undefined)
                            .map((c, i) => {
                              const isSelected = !!(devSelectedCards[id] || []).find(
                                (sc) => sc.suit === c.suit && sc.rank === c.rank,
                              );
                              return (
                                <div
                                  key={i}
                                  onClick={() => handleDevCardClick(id, c)}
                                  className={`cursor-pointer transition-all shadow-xl relative group ${isSelected ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] -translate-y-4 z-40 scale-110' : 'hover:-translate-y-6 hover:scale-110 z-10 hover:z-50'}`}
                                >
                                  <UICard card={c} />
                                </div>
                              );
                            })}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-center mt-2 w-full">
                          <button
                            onClick={() => handleDevAction(id, 'attack')}
                            className="bg-red-600 hover:bg-red-500 text-[10px] px-2 py-1 rounded shadow"
                          >
                            Atk ({(devSelectedCards[id] || []).length})
                          </button>
                          <button
                            onClick={() => handleDevAction(id, 'defend')}
                            className="bg-green-600 hover:bg-green-500 text-[10px] px-2 py-1 rounded shadow"
                          >
                            Def
                          </button>
                          <button
                            onClick={() => handleDevAction(id, 'pickUp')}
                            className="bg-yellow-600 hover:bg-yellow-500 text-[10px] text-yellow-900 px-2 py-1 rounded shadow"
                          >
                            Pick
                          </button>
                          <button
                            onClick={() => handleDevAction(id, 'swapHuzur')}
                            className="bg-purple-600 hover:bg-purple-500 text-[10px] px-2 py-1 rounded shadow"
                          >
                            Swap
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-xl md:text-2xl -mt-1 md:-mt-1">🃏</span>
                        <span>{player.hand.length}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Dev Tools Panel */}
      {isDevMode && (
        <div className="absolute top-4 right-4 bg-red-950/90 text-white p-3 rounded-xl border-2 border-red-500 shadow-2xl z-50 flex flex-col space-y-2 backdrop-blur-md w-48">
          <div className="font-bold text-xs uppercase tracking-widest border-b border-red-500/50 pb-1 text-red-300">
            Dev Tools
          </div>
          <button
            onClick={devSpawnDummies}
            className="bg-red-800 hover:bg-red-700 px-2 py-1.5 rounded text-xs transition border border-red-600 shadow-inner"
          >
            Spawn Dummies
          </button>
          <button
            onClick={devForcePass}
            className="bg-red-800 hover:bg-red-700 px-2 py-1.5 rounded text-xs transition border border-red-600 shadow-inner"
          >
            Force Pass
          </button>
          <button
            onClick={devCopyLog}
            className="bg-blue-800 hover:bg-blue-700 px-2 py-1.5 rounded text-xs transition border border-blue-600 shadow-inner"
          >
            Copy Log ({gameState.actionLog?.length || 0})
          </button>
          <div className="text-[10px] text-red-300/60 mt-1 italic">
            Click an opponent's card to play as them.
          </div>
        </div>
      )}

      {/* Center Table Area */}
      <div className="flex-1 flex w-full relative z-0 h-full overflow-hidden">
        {/* Phase: Waiting Overlay */}
        <AnimatePresence>
          {gameState.phase === 'waiting' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col md:flex-row items-stretch justify-center bg-black/80 backdrop-blur-md rounded-2xl overflow-hidden"
            >
              {/* Left Side: Settings Panel */}
              <div className="w-full md:w-1/3 md:max-w-xs bg-black/60 border-r border-white/10 p-4 md:p-6 flex flex-col overflow-y-auto">
                <h2 className="text-xl md:text-2xl font-black text-white mb-4 md:mb-6 uppercase tracking-wider text-center border-b border-white/10 pb-4">
                  Game Settings
                </h2>

                <div className="flex-1 space-y-4 md:space-y-6">
                  <div className="space-y-1 md:space-y-2">
                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">
                      Game Mode
                    </label>
                    {room.sessionId === gameState.hostId ? (
                      <select
                        value={gameState.mode}
                        onChange={(e) => updateLobbySettings({ mode: e.target.value })}
                        className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                      >
                        <option value="classic">Classic (Free-for-all)</option>
                        <option value="teams">Teams (2v2, 3v3)</option>
                      </select>
                    ) : (
                      <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-bold">
                        {gameState.mode === 'teams' ? 'Teams (2v2, 3v3)' : 'Classic (Free-for-all)'}
                      </div>
                    )}
                  </div>

                  {gameState.mode === 'teams' && (
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">
                        Team Selection
                      </label>
                      {room.sessionId === gameState.hostId ? (
                        <select
                          value={gameState.teamSelection}
                          onChange={(e) => updateLobbySettings({ teamSelection: e.target.value })}
                          className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                        >
                          <option value="random">Random Assignment</option>
                          <option value="manual">Manual Selection</option>
                        </select>
                      ) : (
                        <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-bold">
                          {gameState.teamSelection === 'manual'
                            ? 'Manual Selection'
                            : 'Random Assignment'}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 md:space-y-2">
                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">
                      Max Players
                    </label>
                    {room.sessionId === gameState.hostId ? (
                      <select
                        value={gameState.maxPlayers}
                        onChange={(e) =>
                          updateLobbySettings({ maxPlayers: parseInt(e.target.value) })
                        }
                        className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                      >
                        {[2, 3, 4, 5, 6].map((num) => (
                          <option key={num} value={num}>
                            {num} Players
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-bold">
                        {gameState.maxPlayers} Players
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 md:space-y-2">
                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">
                      Starting Hand Size
                    </label>
                    {room.sessionId === gameState.hostId ? (
                      <select
                        value={gameState.targetHandSize}
                        onChange={(e) =>
                          updateLobbySettings({ targetHandSize: parseInt(e.target.value) })
                        }
                        className="w-full bg-green-900/50 text-white border border-green-500/50 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none font-bold shadow-inner"
                      >
                        {[4, 5, 6, 7].map((num) => (
                          <option key={num} value={num}>
                            {num} Cards
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full bg-black/40 text-gray-300 border border-white/5 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-bold">
                        {gameState.targetHandSize} Cards
                      </div>
                    )}
                  </div>
                </div>

                {room.sessionId === gameState.hostId && (
                  <div className="mt-6 pt-6 border-t border-white/10 hidden md:block">
                    <button
                      onClick={startLobbyGame}
                      disabled={
                        gameState.players.size < 2 ||
                        !Array.from(gameState.players.values()).every((p) => p.isReady)
                      }
                      className={`w-full py-4 rounded-xl font-black text-xl shadow-lg transition-all ${
                        gameState.players.size >= 2 &&
                        Array.from(gameState.players.values()).every((p) => p.isReady)
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 hover:scale-105 active:scale-95'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      START GAME
                    </button>
                    <p className="text-xs text-center text-gray-400 mt-3 font-medium">
                      All players must be ready to start.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Side: Players Panel */}
              <div className="flex-1 flex flex-col p-4 md:p-6 relative">
                <div className="flex justify-between items-end mb-4 md:mb-6 border-b border-white/10 pb-4">
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider flex items-center">
                    Lobby{' '}
                    <span className="ml-3 bg-white/10 text-white text-sm px-3 py-1 rounded-full">
                      {gameState.players.size}/{gameState.maxPlayers}
                    </span>
                  </h2>
                  <div className="text-right">
                    <span className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-wider block">
                      Invite Code
                    </span>
                    <span className="font-mono text-sm md:text-xl text-yellow-400 bg-black/50 px-2 py-1 md:px-3 md:py-1 rounded border border-yellow-500/30 select-all cursor-pointer">
                      {room.id}
                    </span>
                  </div>
                </div>

                {gameState.mode === 'teams' && gameState.teamSelection === 'manual' && myPlayer && (
                  <div className="mb-4 md:mb-6 bg-black/40 p-3 md:p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center mb-3 md:mb-4">
                      <span className="text-xs md:text-sm font-bold text-gray-400 uppercase">
                        Select Your Team
                      </span>
                      <span
                        className={`text-[10px] md:text-xs px-2 py-1 rounded font-bold ${teamBlueCount === teamRedCount ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}
                      >
                        {teamBlueCount === teamRedCount ? 'Balanced' : 'Unbalanced'}
                      </span>
                    </div>
                    <div className="flex space-x-2 md:space-x-4">
                      <button
                        onClick={() => handleTeamSelect(0)}
                        className={`flex-1 py-2 md:py-3 rounded-lg text-xs md:text-sm font-bold shadow transition ${myPlayer.team === 0 ? 'bg-blue-600 text-white ring-2 ring-white' : 'bg-blue-900/50 hover:bg-blue-800 text-blue-200'}`}
                      >
                        {myPlayer.team === 0 ? '✓ Team Blue' : 'Join Team Blue'}
                      </button>
                      <button
                        onClick={() => handleTeamSelect(1)}
                        className={`flex-1 py-2 md:py-3 rounded-lg text-xs md:text-sm font-bold shadow transition ${myPlayer.team === 1 ? 'bg-red-600 text-white ring-2 ring-white' : 'bg-red-900/50 hover:bg-red-800 text-red-200'}`}
                      >
                        {myPlayer.team === 1 ? '✓ Team Red' : 'Join Team Red'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pb-20 md:pb-0">
                    {Array.from(gameState.players.entries()).map(([id, p]) => (
                      <div
                        key={id}
                        className={`flex items-center p-2 md:p-3 rounded-xl border transition-all ${id === room.sessionId ? 'bg-green-900/30 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-black/50 border-white/5'}`}
                      >
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.username || id}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-black/50 shadow-md"
                          />
                        ) : (
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center font-bold text-gray-400">
                            {(p.username || id).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="ml-3 md:ml-4 flex-1 overflow-hidden">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm md:text-base text-white truncate max-w-full">
                              {p.username || id.slice(0, 8)}
                            </span>
                            {id === gameState.hostId && (
                              <span
                                className="bg-yellow-500 text-yellow-900 text-[9px] md:text-[10px] font-black px-1.5 md:px-2 py-0.5 rounded-sm uppercase tracking-wider"
                                title="Lobby Host"
                              >
                                Host
                              </span>
                            )}
                            {id === room.sessionId && (
                              <span className="bg-white/10 text-gray-300 text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-sm">
                                YOU
                              </span>
                            )}
                          </div>
                          {gameState.mode === 'teams' && (
                            <div
                              className={`text-[10px] md:text-xs font-bold mt-0.5 md:mt-1 ${p.team === 0 ? 'text-blue-400' : p.team === 1 ? 'text-red-400' : 'text-gray-500'}`}
                            >
                              {p.team === 0 ? 'Team Blue' : p.team === 1 ? 'Team Red' : 'No Team'}
                            </div>
                          )}
                        </div>
                        <div className="ml-2">
                          {p.isReady ? (
                            <span className="bg-green-500/20 text-green-400 text-[10px] md:text-xs font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-green-500/30">
                              Ready
                            </span>
                          ) : (
                            <span className="bg-white/5 text-gray-400 text-[10px] md:text-xs font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-white/10">
                              Waiting
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Host Start Game Button */}
                {room.sessionId === gameState.hostId && (
                  <div className="md:hidden mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={startLobbyGame}
                      disabled={
                        gameState.players.size < 2 ||
                        !Array.from(gameState.players.values()).every((p) => p.isReady)
                      }
                      className={`w-full py-3 rounded-xl font-black text-lg shadow-lg transition-all ${
                        gameState.players.size >= 2 &&
                        Array.from(gameState.players.values()).every((p) => p.isReady)
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 hover:scale-105 active:scale-95'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      START GAME
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-2 font-medium">
                      All players must be ready to start.
                    </p>
                  </div>
                )}

                {/* Guest Ready Button / Host Ready Toggle */}
                {room.sessionId !== gameState.hostId && (
                  <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
                    <p className="text-gray-400 text-xs md:text-sm font-medium">
                      Waiting for host to start...
                    </p>
                    <button
                      onClick={handleToggleReady}
                      className={`w-full md:w-auto px-6 md:px-8 py-3 md:py-4 font-black text-base md:text-lg rounded-xl shadow-lg transition-all ${
                        myPlayer?.isReady
                          ? 'bg-green-500 hover:bg-green-400 text-green-900 hover:scale-105 active:scale-95 ring-2 ring-green-300'
                          : 'bg-white/10 hover:bg-white/20 text-white active:scale-95'
                      }`}
                    >
                      {myPlayer?.isReady ? 'READY TO PLAY' : 'CLICK TO READY'}
                    </button>
                  </div>
                )}

                {room.sessionId === gameState.hostId && !myPlayer?.isReady && (
                  <div className="absolute top-4 right-4 md:bottom-6 md:right-6 md:top-auto">
                    <button
                      onClick={handleToggleReady}
                      className="px-4 py-2 md:px-6 md:py-3 text-xs md:text-sm bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95"
                    >
                      Mark Self Ready
                    </button>
                  </div>
                )}
                {room.sessionId === gameState.hostId && myPlayer?.isReady && (
                  <div className="absolute top-4 right-4 md:bottom-6 md:right-6 md:top-auto">
                    <button
                      onClick={handleToggleReady}
                      className="px-4 py-2 md:px-6 md:py-3 text-xs md:text-sm bg-green-900/40 text-green-400 rounded-xl font-bold border border-green-500/30 transition-all active:scale-95"
                    >
                      You are Ready
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase: Playing */}
        {gameState.phase === 'playing' && (
          <div className="flex flex-col md:flex-row w-full h-full bg-black/20 rounded-xl border border-white/5 shadow-inner">
            {/* Left Column: Deck & Trump */}
            <div className="md:w-64 w-full h-40 md:h-full flex-shrink-0 flex items-center justify-center relative border-b md:border-b-0 md:border-r border-white/10 p-4">
              {gameState.huzurCard && (
                <div className="flex flex-row items-center justify-center gap-6 w-full h-full min-h-[200px]">
                  {/* The Deck Stack */}
                  <div className="relative w-[80px] h-[120px]">
                    {(() => {
                      const deckLength = gameState.deck?.length || 0;
                      const layers = Math.min(3, Math.max(1, Math.ceil(deckLength / 10)));
                      if (deckLength === 0) return null;
                      return Array.from({ length: layers }).map((_, i) => (
                        <div
                          key={`deck-${i}`}
                          className="absolute top-0 left-0 w-full h-full bg-red-900 rounded-lg shadow-[0_5px_15px_rgba(0,0,0,0.5)] border border-white/20 flex flex-col items-center justify-center overflow-hidden"
                          style={{
                            zIndex: layers - i,
                            marginLeft: `${i * 3}px`,
                            marginTop: `-${i * 3}px`,
                          }}
                        >
                          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiM4YjAwMDAiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzlhMTExMSIgc3Ryb2tlLXdpZHRoPSIxIj48L3BhdGg+PC9zdmc+')] opacity-60"></div>
                          {i === 0 && (
                            <span className="text-white z-10 font-black text-2xl bg-black/60 px-2 py-1 rounded shadow-inner">
                              {deckLength}
                            </span>
                          )}
                        </div>
                      ));
                    })()}

                    {/* Empty Deck Placeholder */}
                    {(gameState.deck?.length || 0) <= 0 && (
                      <div className="absolute top-0 left-0 w-full h-full rounded-lg border-2 border-dashed border-white/20 z-0 flex items-center justify-center opacity-50 bg-black/20"></div>
                    )}

                    {/* Status Text Block directly underneath Deck */}
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-yellow-900/80 px-3 py-1 rounded-lg text-xs font-bold ring-1 ring-yellow-500 z-10 whitespace-nowrap shadow-lg">
                      Trump: {gameState.huzurSuit}
                    </div>
                  </div>

                  {/* The Fully Visible Trump Card */}
                  <div className="relative z-0 mt-4">
                    <UICard
                      card={gameState.huzurCard}
                      className="brightness-100 border-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Center Column: Table Cards */}
            <div className="flex-1 flex flex-col flex-wrap content-center justify-center gap-6 p-4 md:p-8 overflow-y-auto relative">
              {/* Timer Display - Sand Clock outside table */}
              {isMyTurn && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="absolute -top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50"
                >
                  <motion.div
                    animate={
                      shouldShake
                        ? { x: [0, -4, 4, -4, 0], rotate: [0, -2, 2, -2, 0] }
                        : { x: 0, rotate: 0 }
                    }
                    transition={shouldShake ? { duration: 0.3, repeat: Infinity } : { duration: 0 }}
                    className={`text-6xl md:text-7xl drop-shadow-2xl`}
                  >
                    ⏳
                  </motion.div>
                  <div
                    className={`text-2xl md:text-3xl font-black tabular-nums ${getTimerColor()} drop-shadow-lg`}
                  >
                    {(timeRemaining / 1000).toFixed(1)}s
                  </div>
                </motion.div>
              )}

              {/* Table Pairs */}
              {Array.from({ length: Math.ceil(tableCards.length / 2) }).map((_, pairIndex) => {
                const atk = tableCards[pairIndex * 2];
                const def = tableCards[pairIndex * 2 + 1];
                if (!atk) return null;

                return (
                  <div
                    key={`table-pair-${pairIndex}-${atk.suit}-${atk.rank}`}
                    className="flex space-x-2 bg-black/40 p-3 rounded-2xl border border-white/10 shadow-xl items-center min-w-max"
                  >
                    <div className="flex flex-col items-center">
                      <div className="text-[9px] md:text-[10px] text-gray-300 font-bold mb-2 uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded whitespace-nowrap">
                        Attack
                      </div>
                      {/* Keep card size scalable depending on screen using transforms or set widths */}
                      <div className="scale-75 md:scale-90 origin-top h-[140px] md:h-[160px]">
                        <UICard card={atk} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-[9px] md:text-[10px] text-green-400 font-bold mb-2 uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded whitespace-nowrap">
                        Defend
                      </div>
                      {def ? (
                        <div className="scale-75 md:scale-90 origin-top shadow-[0_0_15px_rgba(34,197,94,0.3)] rounded-lg h-[140px] md:h-[160px]">
                          <UICard card={def} />
                        </div>
                      ) : (
                        <div className="scale-75 md:scale-90 origin-top h-[140px] md:h-[160px] flex">
                          <div className="w-[120px] h-[178px] rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center bg-black/30">
                            <span className="text-white/20 text-xs font-bold uppercase tracking-widest text-center px-2">
                              Awaiting
                              <br />
                              Defense
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Issue #80: show EXACT attack+defense cards for 10 seconds after a defend */}
              {defenseSnapshot && defenseVisible && (
                <div className="w-full flex justify-center">
                  <div className="flex flex-row flex-wrap justify-center gap-6">
                    {defenseSnapshot.attacking.map((atk, idx) => {
                      const def = defenseSnapshot.defending[idx];
                      if (!def) return null;

                      return (
                        <div
                          key={`snap-pair-${idx}-${atk.suit}-${atk.rank}`}
                          className="relative w-[120px] h-[178px]"
                        >
                          {/* Bottom: attack card */}
                          <div className="absolute left-0 top-0 scale-75 md:scale-90 origin-top-left opacity-100">
                            <UICard card={atk as unknown as SharedCard} className="opacity-100" />
                          </div>

                          {/* Top: defend card stacked */}
                          <div className="absolute left-7 top-7 scale-75 md:scale-90 origin-top-left shadow-[0_0_18px_rgba(34,197,94,0.4)] rounded-lg ring-2 ring-green-400/40 opacity-100">
                            <UICard card={def as unknown as SharedCard} className="opacity-100" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Attack Cards (Incoming) */}
              {attackCards.map((atk, i) => (
                <div
                  key={`atk-${i}-${atk.suit}-${atk.rank}`}
                  className="flex flex-col bg-red-900/20 p-3 rounded-2xl border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.2)] items-center min-w-max"
                >
                  <div className="text-[9px] md:text-[10px] text-red-400 font-bold mb-2 uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded animate-pulse whitespace-nowrap">
                    Incoming
                  </div>
                  <div className="scale-75 md:scale-90 origin-top h-[140px] md:h-[160px]">
                    <UICard card={atk} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Area: Controls & Hand */}
      <div className="flex flex-col items-center space-y-2 md:space-y-4 flex-shrink-0">
        {/* Actions Menu */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 z-30">
          {isMyTurn && gameState.phase === 'playing' && attackCards.length === 0 && (
            <>
              <button
                onClick={handleAttack}
                disabled={selectedCards.length === 0}
                className="px-6 py-2 md:px-8 md:py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold shadow-lg transition active:scale-95 text-xs md:text-base"
              >
                Attack ({selectedCards.length})
              </button>
            </>
          )}
          {isMyTurn && gameState.phase === 'playing' && attackCards.length > 0 && (
            <>
              <button
                onClick={handleDefend}
                disabled={selectedCards.length === 0}
                className="px-6 py-2 md:px-8 md:py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold shadow-lg transition active:scale-95 text-xs md:text-base"
              >
                Defend ({selectedCards.length})
              </button>
              <button
                onClick={handlePickUp}
                className="px-6 py-2 md:px-8 md:py-3 bg-yellow-600 hover:bg-yellow-500 rounded-full text-yellow-900 font-bold shadow-lg transition active:scale-95 text-xs md:text-base"
              >
                Pick Up
              </button>
            </>
          )}
          {gameState.phase === 'playing' &&
            (gameState.deck?.length || 0) > 0 &&
            gameState.huzurCard &&
            (gameState.huzurCard.isJoker ? (
              myHand.some((c) => c.suit === 'Spades' && c.rank === 16) &&
              !myPlayer?.pickedUpCardKeys.includes('Spades:16:0') ? (
                <button
                  onClick={handleSwapHuzur}
                  className="px-6 py-2 md:px-8 md:py-3 mx-4 bg-purple-600 hover:bg-purple-500 rounded-full font-bold shadow-lg transition active:scale-95 text-xs md:text-base"
                >
                  Swap Ace
                </button>
              ) : null
            ) : myHand.some((c) => c.suit === gameState.huzurSuit && c.rank === 7) &&
              !myPlayer?.pickedUpCardKeys.includes(`${gameState.huzurSuit}:7:0`) ? (
              <button
                onClick={handleSwapHuzur}
                className="px-6 py-2 md:px-8 md:py-3 mx-4 bg-purple-600 hover:bg-purple-500 rounded-full font-bold shadow-lg transition active:scale-95 text-xs md:text-base"
              >
                Swap 7
              </button>
            ) : null)}
        </div>

        {/* Local Player Hand */}
        <div className="w-full bg-black/30 border border-white/5 shadow-inner rounded-2xl overflow-hidden relative min-h-[120px] md:min-h-[220px]">
          {/* Local Player Profile */}
          {myPlayer && (
            <div className="absolute top-2 left-3 md:top-4 md:left-4 flex items-center space-x-2 z-10 bg-black/40 pr-3 rounded-full border border-white/10">
              {myPlayer.avatarUrl && (
                <img
                  src={myPlayer.avatarUrl}
                  alt={myPlayer.username}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full shadow-md"
                />
              )}
              <span className="text-xs md:text-sm font-bold text-gray-200 truncate max-w-[100px] md:max-w-[150px]">
                {myPlayer.username || 'Me'}
              </span>
            </div>
          )}

          {/* Mobile: horizontal scroll so every card is reachable. Desktop: centered overlap fan */}
          <div className="flex flex-row overflow-x-auto md:overflow-x-visible py-4 md:py-6 items-end md:justify-center w-full h-full relative px-2 md:px-4 custom-scrollbar">
            {/* Deck Origin Point (Invisible marker for animation origins) */}
            <div
              className="absolute top-[-100px] md:top-[-200px] left-1/2 -translate-x-1/2 w-1 h-1"
              id="deck-origin"
            ></div>
            {/* Mobile: w-max so scroll works. Desktop: max-w-full so overlap compresses */}
            <div className="flex flex-row w-max md:w-auto md:max-w-full md:justify-center gap-2 md:gap-0 px-2 md:px-0">
              <AnimatePresence>
                {myHand.map((card, i) => {
                  const isSelected = !!selectedCards.find(
                    (c) => c.suit === card.suit && c.rank === card.rank,
                  );
                  const animationDelayMs = i * 150; // 0.15s stagger

                  // Desktop-only overlap fanning
                  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
                  const maxOverlap = 80;
                  const overlapIntensity = 4;
                  const overlapAmount =
                    isDesktop && myHand.length > 7
                      ? Math.min(maxOverlap, (myHand.length - 7) * overlapIntensity)
                      : 0;

                  return (
                    <motion.div
                      key={`${card.suit}-${card.rank}`}
                      layoutId={`card-${card.suit}-${card.rank}`}
                      initial={{ opacity: 0, y: -400, scale: 0.3 }}
                      animate={{
                        opacity: 1,
                        y: isSelected ? (isDesktop ? -20 : -10) : 0,
                        scale: 1,
                      }}
                      exit={{ opacity: 0, scale: 0.5, y: -200 }}
                      transition={{
                        type: 'spring',
                        stiffness: 280,
                        damping: 25,
                        delay: i * 0.15,
                        mass: 0.8,
                      }}
                      style={{
                        marginLeft: i > 0 && isDesktop ? `-${overlapAmount}px` : undefined,
                        zIndex: isSelected ? 100 : i,
                      }}
                      className={`cursor-pointer transition-shadow rounded-lg duration-200 transform origin-bottom flex-shrink-0 relative group ${isSelected ? 'shadow-[0_10px_20px_rgba(250,204,21,0.6)] ring-2 md:shadow-[0_15px_30px_rgba(250,204,21,0.6)] md:ring-4 ring-yellow-400' : 'hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] hover:-translate-y-4 md:hover:-translate-y-6 hover:z-[90]'}`}
                    >
                      <DealSoundTrigger delayMs={animationDelayMs} playSound={playDealSound} />
                      <UICard card={card} isPlayable={true} onClick={handleCardClick} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {/* Trailing spacer for scroll padding on mobile */}
              <div className="w-2 flex-shrink-0 md:hidden" />
            </div>
          </div>
        </div>
      </div>

      {/* Game Over Overlay (High Priority z-index) */}
      {gameState.phase === 'finished' && (
        <div className="absolute inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md">
          <div className="bg-gray-900 border-2 border-yellow-500 rounded-3xl p-12 flex flex-col items-center shadow-[0_0_50px_rgba(250,204,21,0.3)] text-center max-w-lg w-full">
            {gameState.loser === room.sessionId ? (
              <>
                <h1 className="text-7xl mb-6 pb-4 border-b border-gray-700 w-full">🥴</h1>
                <h2 className="text-4xl font-extrabold text-red-500 mb-3 tracking-wide">
                  YOU ARE THE DURAK!
                </h2>
                <p className="text-gray-400 text-lg">Ah well, better luck next time.</p>
              </>
            ) : gameState.loser === null ? (
              <>
                <h1 className="text-7xl mb-6 pb-4 border-b border-gray-700 w-full">🤝</h1>
                <h2 className="text-4xl font-extrabold text-blue-400 mb-3 tracking-wide">DRAW!</h2>
                <p className="text-gray-400 text-lg">Everybody wins (or loses?).</p>
              </>
            ) : (
              <>
                <h1 className="text-7xl mb-6 pb-4 border-b border-gray-700 w-full">👑</h1>
                <h2 className="text-4xl font-extrabold text-yellow-400 mb-3 tracking-wide">
                  YOU SURVIVED!
                </h2>
                <p className="text-gray-400 text-lg">
                  The fool is {gameState.loser.slice(0, 5)}...
                </p>
              </>
            )}
            <button
              onClick={handleStartGame}
              className="mt-10 px-10 py-5 bg-gradient-to-br from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-yellow-950 font-black text-2xl rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)] transition active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
