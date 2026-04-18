import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Client, Room } from 'colyseus.js';
import { GameState } from '@durak/shared';

interface GameContextState {
  client: Client | null;
  room: Room<GameState> | null;
  error: string | null;
  isConnected: boolean;
  gameState: GameState | null;
  gameMessage: string | null;
  clearGameMessage: () => void;
}

const GameContext = createContext<GameContextState>({
  client: null,
  room: null,
  error: null,
  isConnected: false,
  gameState: null,
  gameMessage: null,
  clearGameMessage: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => useContext(GameContext);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const client = useMemo(() => new Client(import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567'), []);
  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // Colyseus mutates state in place, so we need a manual tick to trigger React updates
  const [, setTick] = useState(0);
  const gameState = room?.state || null;

  const clearGameMessage = () => setGameMessage(null);

  useEffect(() => {
    let currentRoom: Room<GameState> | null = null;
    let isMounted = true;
    let connectionPromise: Promise<Room<GameState>> | null = null;

    const connectToRoom = async () => {
      try {
        connectionPromise = client.joinOrCreate<GameState>('durak');
        const roomInstance = await connectionPromise;
        
        if (!isMounted) {
          // If the component unmounted while connecting (e.g. React 18 Strict Mode), leave immediately.
          roomInstance.leave();
          return;
        }
        
        currentRoom = roomInstance;
        
        currentRoom.onStateChange(() => {
          setTick(t => t + 1);
        });

        currentRoom.onMessage('error', (message: string) => {
          setGameMessage(`Error: ${message}`);
          setTimeout(() => setGameMessage(null), 4000);
        });

        currentRoom.onMessage('playerWon', (playerId: string) => {
          if (playerId === currentRoom?.sessionId) {
            setGameMessage('🎉 You won!');
          } else {
            setGameMessage(`🎉 Player ${playerId} has won!`);
          }
          setTimeout(() => setGameMessage(null), 4000);
        });

        currentRoom.onMessage('gameOver', (data: { loser?: string, draw?: boolean }) => {
          if (data.draw) {
            setGameMessage('Game Over! It is a draw.');
          } else if (data.loser === currentRoom?.sessionId) {
            setGameMessage('😭 Game Over. You are the Durak (Fool)!');
          } else {
            setGameMessage(`🎉 Game Over! ${data.loser} is the Durak.`);
          }
        });

        currentRoom.onError((code, message) => {
          console.error('Room error:', code, message);
          setError(message || 'Unknown room error');
        });

        currentRoom.onLeave((code) => {
          console.log('Left room:', code);
          setIsConnected(false);
          setRoom(null);
        });

        setRoom(currentRoom);
        setIsConnected(true);
        // Force an initial render with the room's initial state
        setTick(1);
      } catch (e: unknown) {
        console.error('Error joining room:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect to server');
      }
    };

    const connectToRoomAsync = async () => {
      connectToRoom();
    };
    
    connectToRoomAsync();

    return () => {
      isMounted = false;
      if (currentRoom) {
        currentRoom.leave();
      }
    };
  }, [client]);

  return (
    <GameContext.Provider value={{ client, room, error, isConnected, gameState, gameMessage, clearGameMessage }}>
      {children}
    </GameContext.Provider>
  );
};
