import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Client, Room } from 'colyseus.js';
import { GameState } from '@durak/shared';

interface GameContextState {
  client: Client | null;
  room: Room<GameState> | null;
  error: string | null;
  isConnected: boolean;
  gameState: GameState | null;
}

const GameContext = createContext<GameContextState>({
  client: null,
  room: null,
  error: null,
  isConnected: false,
  gameState: null,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => useContext(GameContext);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const client = useMemo(() => new Client(import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567'), []);
  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    let currentRoom: Room<GameState> | null = null;

    const connectToRoom = async () => {
      try {
        currentRoom = await client.joinOrCreate<GameState>('durak');
        
        currentRoom.onStateChange((state) => {
          // Deep clone is costly, but we can do a state spread just to ensure React sees a "new" object.
          // For Colyseus schema, a tick variable is often the easiest way to force React to re-render.
          setGameState({ ...state } as GameState);
        });

        currentRoom.onError((code, message) => {
          console.error('Room error:', code, message);
          setError(message);
        });

        currentRoom.onLeave((code) => {
          console.log('Left room:', code);
          setIsConnected(false);
          setRoom(null);
          setGameState(null);
        });

        setRoom(currentRoom);
        setIsConnected(true);
      } catch (e: unknown) {
        console.error('Error joining room:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect to server');
      }
    };

    connectToRoom();

    return () => {
      // Cleanup on unmount
      if (currentRoom) {
        currentRoom.leave();
      }
    };
  }, [client]);

  return (
    <GameContext.Provider value={{ client, room, error, isConnected, gameState }}>
      {children}
    </GameContext.Provider>
  );
};
