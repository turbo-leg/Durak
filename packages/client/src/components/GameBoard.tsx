import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Card as UICard } from './Card';
import { Card as SharedCard } from '@durak/shared';

export const GameBoard: React.FC = () => {
  const { room, gameState, gameMessage, clearGameMessage } = useGame();
  const [selectedCards, setSelectedCards] = useState<SharedCard[]>([]);

  if (!room || !gameState) {
    return null;
  }

  const isMyTurn = gameState.currentTurn === room.sessionId;
  const myPlayer = gameState.players.get(room.sessionId);
  const myHand = myPlayer ? Array.from(myPlayer.hand).filter((c): c is SharedCard => c !== undefined) : [];
  const tableCards = Array.from(gameState.table || []).filter((c): c is SharedCard => c !== undefined);
  const attackCards = Array.from(gameState.activeAttackCards || []).filter((c): c is SharedCard => c !== undefined);
  
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

  const handlePass = () => {
    room.send("pass");
  };

  const handleTeamSelect = (teamId: number) => {
    room.send("switchTeam", { team: teamId });
  };

  return (
    <div className="flex flex-col h-full w-full justify-between items-center bg-green-900 rounded-xl border border-green-800 shadow-2xl overflow-hidden p-6 relative">
      
      {/* Top Banner: Status */}
      <div className="absolute top-4 left-4 bg-black/40 text-green-200 px-4 py-2 rounded-lg text-sm font-mono flex items-center space-x-4 z-50">
        <div>Phase: <span className="font-bold text-white">{gameState.phase}</span></div>
        <div>Turn: <span className={`font-bold ${isMyTurn ? 'text-yellow-400' : 'text-gray-400'}`}>{isMyTurn ? 'Yours' : 'Opponent'}</span></div>
        <div>Deck: <span className="font-bold text-white">{gameState.deck?.length || 0}</span></div>
        <div>Colyseus Session ID: <span className="text-gray-400">{room.sessionId}</span></div>
      </div>

      {/* Game Message Toast */}
      {gameMessage && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-600 border border-red-400 font-bold text-white px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center space-x-4 animate-bounce">
          <span>{gameMessage}</span>
          <button onClick={clearGameMessage} className="text-red-200 hover:text-white">&times;</button>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState.phase === 'finished' && (
        <div className="absolute inset-0 bg-black/80 z-40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gray-900 border-2 border-yellow-500 rounded-2xl p-12 flex flex-col items-center shadow-2xl text-center">
            {gameState.loser === room.sessionId ? (
              <>
                <h1 className="text-6xl mb-4">🥴</h1>
                <h2 className="text-4xl font-extrabold text-red-500 mb-2">YOU ARE THE DURAK!</h2>
                <p className="text-gray-300">Ah well, better luck next time.</p>
              </>
            ) : gameState.loser === null ? (
              <>
                <h1 className="text-6xl mb-4">🤝</h1>
                <h2 className="text-4xl font-extrabold text-blue-400 mb-2">DRAW!</h2>
                <p className="text-gray-300">Everybody wins (or loses?).</p>
              </>
            ) : (
              <>
                <h1 className="text-6xl mb-4">👑</h1>
                <h2 className="text-4xl font-extrabold text-yellow-400 mb-2">YOU SURVIVED!</h2>
                <p className="text-gray-300">The fool is {gameState.loser}.</p>
              </>
            )}
            <button 
              onClick={handleStartGame}
              className="mt-8 px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold text-xl rounded-full shadow-lg transition"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Opponents Area */}
      <div className="h-1/5 w-full flex items-start justify-center space-x-8 pt-8 z-10">
         {Array.from(gameState.players.entries()).filter(([id]) => id !== room.sessionId).map(([id, player]) => (
            <div key={id} className="bg-black/40 px-6 py-4 rounded-xl text-center flex flex-col items-center relative border border-white/10 shadow-lg">
              {gameState.currentTurn === id && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-md animate-pulse">
                  PLAYING
                </div>
              )}
              <div className="text-sm text-gray-200 font-mono mb-3 bg-black/50 px-2 py-1 rounded w-full truncate">User: {id.slice(0, 5)}...</div>
              
              <div className="flex -space-x-3 mb-2 h-20">
                {Array.from({ length: Math.min(player.hand.length, 10) }).map((_, i) => (
                  <div key={i} className="w-14 h-20 bg-red-800 rounded shadow-md border-2 border-white/20 relative overflow-hidden flex items-center justify-center transform scale-90">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiM4YjAwMDAiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzlhMTExMSIgc3Ryb2tlLXdpZHRoPSIxIj48L3BhdGg+PC9zdmc+')] opacity-50"></div>
                  </div>
                ))}
                {player.hand.length > 10 && (
                  <div className="w-14 h-20 bg-red-900 rounded shadow-md border-2 border-white/10 flex items-center justify-center text-white/50 text-xs font-bold transform scale-90 z-10">
                    +{player.hand.length - 10}
                  </div>
                )}
              </div>
              <div className="mt-1 font-bold text-yellow-400 text-sm">{player.hand.length} Cards</div>
            </div>
         ))}
      </div>

      {/* Center: Table & Huzur */}
      <div className="h-2/5 flex flex-col items-center justify-center relative w-full">
        {gameState.phase === 'waiting' && gameState.players.size >= 2 && (
          <div className="absolute z-10 flex flex-col items-center space-y-4">
            {gameState.mode === 'teams' && gameState.teamSelection === 'manual' && myPlayer && (
              <div className="flex space-x-4 bg-black/60 p-4 rounded-xl backdrop-blur-md border border-white/10">
                <div className="flex flex-col items-center">
                  <span className="text-blue-300 font-bold mb-2">Team Blue</span>
                  <button 
                    onClick={() => handleTeamSelect(0)}
                    className={`px-6 py-2 rounded font-bold shadow transition ${myPlayer.team === 0 ? 'bg-blue-600 text-white ring-2 ring-white' : 'bg-blue-900/50 hover:bg-blue-800 text-blue-200'}`}
                  >
                    Join
                  </button>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-red-300 font-bold mb-2">Team Red</span>
                  <button 
                    onClick={() => handleTeamSelect(1)}
                    className={`px-6 py-2 rounded font-bold shadow transition ${myPlayer.team === 1 ? 'bg-red-600 text-white ring-2 ring-white' : 'bg-red-900/50 hover:bg-red-800 text-red-200'}`}
                  >
                    Join
                  </button>
                </div>
              </div>
            )}
            <button 
              onClick={handleStartGame} 
              className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold text-xl rounded-full shadow-lg transform transition active:scale-95"
            >
              Start Game
            </button>
          </div>
        )}

        {/* The Huzur/Trump Deck Area */}
        {gameState.phase === 'playing' && gameState.huzurCard && (
           <div className="absolute left-8 top-1/2 transform -translate-y-1/2 flex items-center">
              <div className="relative">
                 <UICard card={gameState.huzurCard} className="rotate-90 relative -left-8 -z-10 brightness-75 border-yellow-500" />
                 <div className="absolute top-0 left-0 w-24 h-36 bg-red-900 rounded-lg shadow-xl border border-white/20 border-dashed z-0 flex items-center justify-center text-4xl text-gray-800/20">🃏</div>
                 <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-yellow-900/80 px-3 py-1 rounded text-xs font-bold ring-1 ring-yellow-500">
                    Trump: {gameState.huzurSuit}
                 </div>
              </div>
           </div>
        )}

        {/* The Active Attack & Table Area */}
        <div className="flex flex-row flex-wrap space-x-6 justify-center mt-8">
           {/* History Table Cards (paired: attack underneath, defend on top) */}
           {Array.from({ length: Math.ceil(tableCards.length / 2) }).map((_, pairIndex) => {
             const atk = tableCards[pairIndex * 2];
             const def = tableCards[pairIndex * 2 + 1];
             if (!atk) return null; // Avoid rendering undefined

             return (
               <div key={`table-pair-${pairIndex}`} className="relative mx-3 transform scale-90 opacity-80 pointer-events-none">
                 {/* Bottom card: the attack that was beaten */}
                 <div className="absolute top-0 left-0 transform rotate-[-5deg] grayscale-[0.3]">
                   <UICard card={atk} />
                 </div>
                 {/* Top card: the successful defense, slightly offset */}
                 {def && (
                   <div className="relative top-4 left-4 shadow-[0_5px_15px_rgba(0,0,0,0.5)] z-10 transform rotate-[3deg]">
                     <UICard card={def} />
                   </div>
                 )}
               </div>
             );
           })}
           
           {/* Current Active Attack Cards */}
           {attackCards.map((atk, i) => (
              <div key={`atk-${i}`} className="relative ml-8 mr-4 shadow-[0_0_15px_rgba(250,204,21,0.4)] rounded-lg transform hover:-translate-y-2 transition-transform">
                 <UICard card={atk} />
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold bg-red-600 px-2 rounded-t z-10 whitespace-nowrap">ATTACK</div>
              </div>
           ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-4 mb-4">
        {isMyTurn && gameState.phase === 'playing' && attackCards.length === 0 && (
          <>
             <button onClick={handleAttack} disabled={selectedCards.length === 0} className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold shadow transition">
                Attack ({selectedCards.length})
             </button>
             {/* If we are the attacker but also can pass (meaning a defense happened or we don't want to attack) */}
             {tableCards.length > 0 && (
                <button onClick={handlePass} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold shadow transition">
                   Pass
                </button>
             )}
          </>
        )}
        {isMyTurn && gameState.phase === 'playing' && attackCards.length > 0 && (
          <>
             <button onClick={handleDefend} disabled={selectedCards.length === 0} className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold shadow transition">
                Defend ({selectedCards.length})
             </button>
             <button onClick={handlePickUp} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-yellow-900 font-bold shadow transition">
                Pick Up
             </button>
          </>
        )}
      </div>      {/* Bottom Area: Local Player Hand */}
      <div className="h-1/4 w-full flex flex-col items-center justify-end pb-4">
         <div className="flex justify-center -space-x-4 hover:space-x-2 transition-all duration-300 px-8">
            {myHand.map((card, i) => {
               const isSelected = !!selectedCards.find((c) => c.suit === card.suit && c.rank === card.rank);
               return (
                 <div key={i} className={`transform transition-all ${isSelected ? '-translate-y-6 ring-4 ring-yellow-400 rounded-lg z-20' : 'hover:-translate-y-4 z-10'}`}>
                   <UICard 
                     card={card} 
                     isPlayable={true} 
                     onClick={handleCardClick} 
                     className={isSelected ? 'shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)]' : ''}
                   />
                 </div>
               );
            })}
         </div>
      </div>
      
    </div>
  );
};
