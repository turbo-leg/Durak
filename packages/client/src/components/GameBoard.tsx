import React, { useMemo, useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { Card as UICard } from './Card';
import { Card as SharedCard, Player } from '@durak/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudio } from '../utils/audio';

const DealSoundTrigger = ({ delayMs, playSound }: { delayMs: number, playSound: () => void }) => {
  React.useEffect(() => {
    const t = setTimeout(() => {
      playSound();
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, playSound]);
  return null;
};

export const GameBoard: React.FC = () => {
  const { room, gameState, gameMessage, clearGameMessage } = useGame();
  const [selectedCards, setSelectedCards] = useState<SharedCard[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const { playDealSound } = useAudio();

  // Update timer every 100ms
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') {
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - gameState.turnStartTime;
      const remaining = Math.max(0, gameState.turnTimeLimit - elapsed);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [gameState]);

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
  const myHand = myPlayer ? Array.from(myPlayer.hand).filter((c): c is SharedCard => c !== undefined) : [];
  const tableCards = Array.from(gameState.table || []).filter((c): c is SharedCard => c !== undefined);
  const attackCards = Array.from(gameState.activeAttackCards || []).filter((c): c is SharedCard => c !== undefined);

  const myTeamLabel = gameState.mode === 'teams'
    ? (myPlayer?.team === 0 ? 'BLUE' : 'RED')
    : '—';

  const myTeamBadge = gameState.mode === 'teams'
    ? (myPlayer?.team === 0
        ? 'bg-blue-600/70 text-blue-100 ring-1 ring-blue-300'
        : 'bg-red-600/70 text-red-100 ring-1 ring-red-300')
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
    const alreadySelected = selectedCards.find(c => c.suit === card.suit && c.rank === card.rank);
    if (alreadySelected) {
      setSelectedCards(selectedCards.filter(c => c !== alreadySelected));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleStartGame = () => {
    room.send("startGame");
  };

  const handleAttack = () => {
    if (selectedCards.length > 0) {
      room.send("attack", { cards: selectedCards });
      setSelectedCards([]);
    }
  };

  const handleDefend = () => {
    if (selectedCards.length > 0) {
      room.send("defend", { cards: selectedCards });
      setSelectedCards([]);
    }
  };

  const handlePickUp = () => {
    room.send("pickUp");
  };

  const handleTeamSelect = (teamId: number) => {
    room.send("switchTeam", { team: teamId });
  };

  const handleToggleReady = () => {
    const isReadyNow = !myPlayer?.isReady;
    room.send("toggleReady", { isReady: isReadyNow });
  };

  const handleSwapHuzur = () => {
    room.send("swapHuzur");
  };

  return (
    <div className="flex flex-col md:grid md:grid-rows-[auto_1fr_auto] h-[100dvh] md:h-[95vh] w-full max-w-7xl mx-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 md:rounded-2xl md:ring-4 md:ring-green-900/50 md:shadow-2xl overflow-y-auto md:overflow-hidden p-3 md:p-6 gap-3 md:gap-6 relative text-white">

      {/* Top Banner (Header) & Opponents */}
      <div className="flex flex-col space-y-3 md:space-y-6 flex-shrink-0">
        {/* Banner */}
        <div className="flex items-center justify-between bg-black/40 px-4 md:px-6 py-2 md:py-4 rounded-xl shadow-md border border-white/10 w-full z-10 flex-wrap gap-2 md:gap-4">
           <div className="flex items-center space-x-3 md:space-x-6 text-xs md:text-sm flex-wrap gap-1 md:gap-2">
             <div><span className="text-gray-400">Phase:</span> <span className="font-bold">{gameState.phase}</span></div>
             <div><span className="text-gray-400">Turn:</span> <span className={`font-bold ${isMyTurn ? 'text-yellow-400' : 'text-white'}`}>{isMyTurn ? 'Yours' : 'Opps'}</span></div>
             <div><span className="text-gray-400">Deck:</span> <span className="font-bold">{gameState.deck?.length || 0}</span></div>
           </div>
           {gameState.mode === 'teams' && (
             <div className={`px-2 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold shadow-md ${myTeamBadge}`}>
               Team: {myTeamLabel}
             </div>
           )}
        </div>

        {/* Game Message */}
        <AnimatePresence>
          {gameMessage && (
            <motion.div 
               initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
               className="bg-red-600 border border-red-400 font-bold text-white px-4 py-2 md:px-6 md:py-3 rounded-lg shadow-2xl flex items-center justify-between mx-auto w-full max-w-md z-50 absolute top-16 md:top-20 left-1/2 -translate-x-1/2 text-sm md:text-base"
            >
              <span>{gameMessage}</span>
              <button onClick={clearGameMessage} className="text-red-200 hover:text-white ml-4">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opponents Flex Container */}
        <div className="flex flex-row overflow-x-auto md:flex-wrap md:justify-center gap-2 md:gap-4 z-10 pb-2 md:pb-0 custom-scrollbar">
          {(() => {
            const seatOrder = Array.from(gameState.seatOrder);
            let opponents: { id: string, player: Player }[] = [];
            
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

            return opponents.map(({ id, player }) => (
              <div key={id} className={`bg-black/40 px-3 py-2 md:px-6 md:py-4 rounded-xl text-center flex flex-col items-center relative border shadow-lg min-w-[100px] md:min-w-0 md:sm:w-48 flex-shrink-0 ${gameState.phase === 'waiting' && player.isReady ? 'border-green-500' : 'border-white/10'}`}>
                {gameState.currentTurn === id && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-900 text-[8px] md:text-[9px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-full shadow-md animate-pulse whitespace-nowrap">
                    PLAYING
                  </div>
                )}
                {gameState.phase === 'waiting' && player.isReady && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-green-900 text-[8px] md:text-[9px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-full shadow-md whitespace-nowrap">
                    READY
                  </div>
                )}
                {/* Team badge */}
                {gameState.mode === 'teams' && (
                  <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[8px] md:text-[9px] font-extrabold shadow border whitespace-nowrap ${player.team === 0 ? 'bg-blue-700 text-blue-100 border-blue-300/30' : 'bg-red-700 text-red-100 border-red-300/30'}`}>
                    {player.team === 0 ? 'BLUE' : 'RED'}
                  </div>
                )}

                <div className="text-[10px] md:text-xs text-gray-300 font-mono mb-2 md:mb-3 bg-green-900/40 border border-green-700/50 px-2 py-1 md:px-3 md:py-1.5 rounded w-full overflow-hidden" title={id}>
                   <span className="block">{id.slice(0, 8)}</span>
                </div>
                <div className="mt-1 md:mt-2 text-lg md:text-xl font-bold text-white flex items-center space-x-1 md:space-x-2 bg-black/30 px-3 py-1.5 md:px-4 md:py-2 rounded-lg leading-none">
                  <span className="text-xl md:text-2xl -mt-1 md:-mt-1">🃏</span>
                  <span>{player.hand.length}</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Center Table Area */}
      <div className="flex-1 flex w-full relative z-0 h-full overflow-hidden">
         {/* Phase: Waiting Overlay */}
         <AnimatePresence>
         {gameState.phase === 'waiting' && (
           <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-4 bg-black/40 backdrop-blur-sm rounded-2xl"
           >
             <h2 className="text-2xl font-bold text-white mb-2 shadow-sm text-center">
               Waiting for Players ({gameState.players.size}/{gameState.maxPlayers})
             </h2>

             {gameState.mode === 'teams' && gameState.teamSelection === 'manual' && myPlayer && (
               <div className="flex flex-col items-center space-y-3 bg-black/60 p-6 rounded-xl backdrop-blur-md border border-white/10 max-w-lg w-full">
                 <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold">
                   <span className="inline-flex items-center space-x-2 text-blue-200">
                     <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                     <span>BLUE: {teamBlueCount}</span>
                   </span>
                   <span className="text-white/40">vs</span>
                   <span className="inline-flex items-center space-x-2 text-red-200">
                     <span className="w-2 h-2 rounded-full bg-red-400"></span>
                     <span>RED: {teamRedCount}</span>
                   </span>
                   <span className={`px-2 py-1 rounded ${teamBlueCount === teamRedCount ? 'bg-green-600/40 text-green-200' : 'bg-yellow-600/40 text-yellow-100'}`}>
                     {teamBlueCount === teamRedCount ? 'Balanced' : 'Unbalanced'}
                   </span>
                 </div>

                 <div className="flex space-x-4">
                   <div className="flex flex-col items-center">
                     <span className="text-blue-300 font-bold mb-2">Team Blue</span>
                     <button 
                       onClick={() => handleTeamSelect(0)}
                       className={`px-6 py-2 rounded font-bold shadow transition ${myPlayer.team === 0 ? 'bg-blue-600 text-white ring-2 ring-white' : 'bg-blue-900/50 hover:bg-blue-800 text-blue-200'}`}
                     >
                       {myPlayer.team === 0 ? 'Selected' : 'Join'}
                     </button>
                   </div>
                   <div className="flex flex-col items-center">
                     <span className="text-red-300 font-bold mb-2">Team Red</span>
                     <button 
                       onClick={() => handleTeamSelect(1)}
                       className={`px-6 py-2 rounded font-bold shadow transition ${myPlayer.team === 1 ? 'bg-red-600 text-white ring-2 ring-white' : 'bg-red-900/50 hover:bg-red-800 text-red-200'}`}
                     >
                       {myPlayer.team === 1 ? 'Selected' : 'Join'}
                     </button>
                   </div>
                 </div>

                 {teamBlueCount !== teamRedCount && (
                   <div className="text-xs text-yellow-200/90 bg-yellow-900/40 border border-yellow-600/30 px-3 py-2 rounded text-center">
                     Teams must be balanced to start (2v2 or 3v3). Move players so BLUE and RED have the same number.
                   </div>
                 )}
               </div>
             )}

             <p className="text-sm text-gray-300 text-center max-w-sm">
               Game will start automatically when the room is full ({gameState.maxPlayers}) and everyone is ready.
             </p>

             <button 
               onClick={handleToggleReady} 
               className={`mt-4 px-8 py-4 font-bold text-xl rounded-full shadow-lg transform transition active:scale-95 ${
                  myPlayer?.isReady 
                    ? 'bg-green-500 hover:bg-green-400 text-green-900 ring-4 ring-green-300' 
                    : 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900'
                }`}
             >
               {myPlayer?.isReady ? 'Ready!' : 'Click to Ready'}
             </button>
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
                                 style={{ zIndex: layers - i, marginLeft: `${i * 3}px`, marginTop: `-${i * 3}px` }}
                               >
                                 <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiM4YjAwMDAiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzlhMTExMSIgc3Ryb2tlLXdpZHRoPSIxIj48L3BhdGg+PC9zdmc+')] opacity-60"></div>
                                 {i === 0 && <span className="text-white z-10 font-black text-2xl bg-black/60 px-2 py-1 rounded shadow-inner">{deckLength}</span>}
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
                          <UICard card={gameState.huzurCard} className="brightness-100 border-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
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
                          animate={shouldShake ? { x: [0, -4, 4, -4, 0], rotate: [0, -2, 2, -2, 0] } : { x: 0, rotate: 0 }}
                          transition={shouldShake ? { duration: 0.3, repeat: Infinity } : { duration: 0 }}
                          className={`text-6xl md:text-7xl drop-shadow-2xl`}
                       >
                          ⏳
                       </motion.div>
                       <div className={`text-2xl md:text-3xl font-black tabular-nums ${getTimerColor()} drop-shadow-lg`}>
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
                        <div key={`table-pair-${pairIndex}-${atk.suit}-${atk.rank}`} className="flex space-x-2 bg-black/40 p-3 rounded-2xl border border-white/10 shadow-xl items-center min-w-max">
                           <div className="flex flex-col items-center">
                             <div className="text-[9px] md:text-[10px] text-gray-300 font-bold mb-2 uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded whitespace-nowrap">Attack</div>
                             {/* Keep card size scalable depending on screen using transforms or set widths */}
                             <div className="scale-75 md:scale-90 origin-top h-[140px] md:h-[160px]">
                               <UICard card={atk} />
                             </div>
                           </div>
                           <div className="flex flex-col items-center">
                              <div className="text-[9px] md:text-[10px] text-green-400 font-bold mb-2 uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded whitespace-nowrap">Defend</div>
                              {def ? (
                                <div className="scale-75 md:scale-90 origin-top shadow-[0_0_15px_rgba(34,197,94,0.3)] rounded-lg h-[140px] md:h-[160px]">
                                  <UICard card={def} />
                                </div>
                              ) : (
                                <div className="scale-75 md:scale-90 origin-top h-[140px] md:h-[160px] flex">
                                  <div className="w-[120px] h-[178px] rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center bg-black/30">
                                    <span className="text-white/20 text-xs font-bold uppercase tracking-widest text-center px-2">Awaiting<br/>Defense</span>
                                  </div>
                                </div>
                              )}
                           </div>
                        </div>
                     );
                 })}

                 {/* Active Attack Cards (Incoming) */}
                 {attackCards.map((atk, i) => (
                    <div key={`atk-${i}-${atk.suit}-${atk.rank}`} className="flex flex-col bg-red-900/20 p-3 rounded-2xl border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.2)] items-center min-w-max">
                       <div className="text-[9px] md:text-[10px] text-red-400 font-bold mb-2 uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded animate-pulse whitespace-nowrap">Incoming</div>
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
                <button onClick={handleAttack} disabled={selectedCards.length === 0} className="px-6 py-2 md:px-8 md:py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold shadow-lg transition active:scale-95 text-xs md:text-base">
                   Attack ({selectedCards.length})
                </button>
             </>
           )}
           {isMyTurn && gameState.phase === 'playing' && attackCards.length > 0 && (
             <>
                <button onClick={handleDefend} disabled={selectedCards.length === 0} className="px-6 py-2 md:px-8 md:py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold shadow-lg transition active:scale-95 text-xs md:text-base">
                   Defend ({selectedCards.length})
                </button>
                <button onClick={handlePickUp} className="px-6 py-2 md:px-8 md:py-3 bg-yellow-600 hover:bg-yellow-500 rounded-full text-yellow-900 font-bold shadow-lg transition active:scale-95 text-xs md:text-base">
                   Pick Up
                </button>
             </>
           )}
           {gameState.phase === 'playing' && myHand.some(c => c.suit === gameState.huzurSuit && c.rank === 7) && (gameState.deck?.length || 0) > 0 && (
             <button onClick={handleSwapHuzur} className="px-6 py-2 md:px-8 md:py-3 mx-4 bg-purple-600 hover:bg-purple-500 rounded-full font-bold shadow-lg transition active:scale-95 text-xs md:text-base">
               Swap 7
             </button>
           )}
         </div>

         {/* Local Player Hand */}
         <div className="w-full bg-black/30 border border-white/5 shadow-inner rounded-2xl overflow-hidden relative min-h-[120px] md:min-h-[220px]">
            {/* Mobile: horizontal scroll so every card is reachable. Desktop: centered overlap fan */}
            <div className="flex flex-row overflow-x-auto md:overflow-x-visible py-4 md:py-6 items-end md:justify-center w-full h-full relative px-2 md:px-4 custom-scrollbar">
               {/* Deck Origin Point (Invisible marker for animation origins) */}
               <div className="absolute top-[-100px] md:top-[-200px] left-1/2 -translate-x-1/2 w-1 h-1" id="deck-origin"></div>
               {/* Mobile: w-max so scroll works. Desktop: max-w-full so overlap compresses */}
               <div className="flex flex-row w-max md:w-auto md:max-w-full md:justify-center gap-2 md:gap-0 px-2 md:px-0">
                  <AnimatePresence>
                     {myHand.map((card, i) => {
                        const isSelected = !!selectedCards.find((c) => c.suit === card.suit && c.rank === card.rank);
                        const animationDelayMs = i * 150; // 0.15s stagger
                        
                        // Desktop-only overlap fanning
                        const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
                        const maxOverlap = 80;
                        const overlapIntensity = 4; 
                        const overlapAmount = isDesktop && myHand.length > 7 ? Math.min(maxOverlap, (myHand.length - 7) * overlapIntensity) : 0;

                        return (
                           <motion.div
                              key={`${card.suit}-${card.rank}`}
                              layoutId={`card-${card.suit}-${card.rank}`}
                              initial={{ opacity: 0, y: -400, scale: 0.3 }}
                              animate={{ opacity: 1, y: isSelected ? (isDesktop ? -20 : -10) : 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5, y: -200 }}
                              transition={{ 
                                type: 'spring', 
                                stiffness: 280, 
                                damping: 25, 
                                delay: i * 0.15,
                                mass: 0.8
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
                <h2 className="text-4xl font-extrabold text-red-500 mb-3 tracking-wide">YOU ARE THE DURAK!</h2>
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
                <h2 className="text-4xl font-extrabold text-yellow-400 mb-3 tracking-wide">YOU SURVIVED!</h2>
                <p className="text-gray-400 text-lg">The fool is {gameState.loser.slice(0,5)}...</p>
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
