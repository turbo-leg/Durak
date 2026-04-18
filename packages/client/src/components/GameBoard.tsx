import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Card as UICard } from './Card';
import { Card as SharedCard } from '@durak/shared';

export const GameBoard: React.FC = () => {
  const { room, gameState } = useGame();
  const [selectedCards, setSelectedCards] = useState<SharedCard[]>([]);

  if (!room || !gameState) {
    return null;
  }

  const isMyTurn = gameState.currentTurn === room.sessionId;
  const myPlayer = gameState.players.get(room.sessionId);
  const myHand = myPlayer ? Array.from(myPlayer.hand) : [];
  const tableCards = Array.from(gameState.table || []);
  const attackCards = Array.from(gameState.activeAttackCards || []);
  
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

  return (
    <div className="flex flex-col h-full w-full justify-between items-center bg-green-900 rounded-xl border border-green-800 shadow-2xl overflow-hidden p-6 relative">
      
      {/* Top Banner: Status */}
      <div className="absolute top-4 left-4 bg-black/40 text-green-200 px-4 py-2 rounded-lg text-sm font-mono flex items-center space-x-4">
        <div>Phase: <span className="font-bold text-white">{gameState.phase}</span></div>
        <div>Turn: <span className={`font-bold ${isMyTurn ? 'text-yellow-400' : 'text-gray-400'}`}>{isMyTurn ? 'Yours' : 'Opponent'}</span></div>
        <div>Deck: <span className="font-bold text-white">{gameState.deck?.length || 0}</span></div>
        <div>Colyseus Session ID: <span className="text-gray-400">{room.sessionId}</span></div>
      </div>

      {/* Opponents Area (Placeholder for now) */}
      <div className="h-1/5 w-full flex items-start justify-center space-x-8 pt-8">
         {Array.from(gameState.players.entries()).filter(([id]) => id !== room.sessionId).map(([id, player]) => (
            <div key={id} className="bg-black/30 px-6 py-3 rounded-lg text-center flex flex-col items-center">
              <div className="text-sm text-gray-300 font-mono mb-2">{id}</div>
              <div className="w-16 h-24 bg-red-800 rounded border-2 border-white/20 shadow-md"></div>
              <div className="mt-2 font-bold text-white">{player.hand.length} Cards</div>
            </div>
         ))}
      </div>

      {/* Center: Table & Huzur */}
      <div className="h-2/5 flex flex-col items-center justify-center relative w-full">
        {gameState.phase === 'waiting' && gameState.players.size >= 2 && (
          <button 
            onClick={handleStartGame} 
            className="absolute z-10 px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold text-xl rounded-full shadow-lg transform transition active:scale-95"
          >
            Start Game
          </button>
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
        <div className="flex flex-row flex-wrap space-x-6 justify-center">
           {/* History Table Cards */}
           {tableCards.map((c, i) => (
             <div key={`table-${i}`} className="relative -ml-4 grayscale opacity-60 pointer-events-none transform -rotate-3 scale-90">
               <UICard card={c} />
             </div>
           ))}
           {/* Current Active Attack Cards */}
           {attackCards.map((atk, i) => (
              <div key={`atk-${i}`} className="relative mr-4 shadow-[0_0_15px_rgba(250,204,21,0.4)] rounded-lg transform hover:-translate-y-2 transition-transform">
                 <UICard card={atk} />
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold bg-red-600 px-2 rounded-t z-10">ATTACK</div>
              </div>
           ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-4 mb-4">
        {isMyTurn && gameState.phase === 'playing' && (
          <>
             <button onClick={handleAttack} disabled={selectedCards.length === 0} className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold shadow transition">
                Attack ({selectedCards.length})
             </button>
             {/* If we are the attacker but also can pass (meaning a defense happened) */}
             {attackCards.length === 0 && tableCards.length > 0 && (
                <button onClick={handlePass} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold shadow transition">
                  Pass
                </button>
             )}
          </>
        )}
        {!isMyTurn && gameState.phase === 'playing' && attackCards.length > 0 && (
          <>
             <button onClick={handleDefend} disabled={selectedCards.length === 0} className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold shadow transition">
                Defend ({selectedCards.length})
             </button>
             <button onClick={handlePickUp} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-yellow-900 font-bold shadow transition">
                Pick Up
             </button>
          </>
        )}
      </div>

      {/* Bottom Area: Local Player Hand */}
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
