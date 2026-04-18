import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Client, Room } from 'colyseus.js';
import { GameState } from '@durak/shared';

interface GameContextState {
  client: Client | null;
  room: Room<GameState> | null;
  error: string | null;
  isConnected: boolean;
}

const GameContext = createContext<GameContextState>({
  client: null,
  room: null,
  error: null,
  isConnected: false,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => useContext(GameContext);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const client = useMemo(() => new Client(import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567'), []);
  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let currentRoom: Room<GameState> | null = null;

    const connectToRoom = async () => {
      try {
        currentRoom = await client.joinOrCreate<GameState>('durak');
        
        currentRoom.onStateChange((state) => {
          console.log('Room state changed:', state);
        });

        currentRoom.onError((code, message) => {
          console.error('Room error:', code, message);
          setError(message);
        });

        currentRoom.onLeave((code) => {
          console.log('Left room:', code);
          setIsConnected(false);
          setRoom(null);
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
    <GameContext.Provider value={{ client, room, error, isConnected }}>
      {children}
    </GameContext.Provider>
  );
};
