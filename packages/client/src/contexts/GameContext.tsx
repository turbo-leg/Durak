import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Client, Room } from 'colyseus.js';
import type { RoomAvailable } from 'colyseus.js';
import { GameState } from '@durak/shared';

type DefenseSnapshot = {
  at: number;
  defenderId: string;
  attacking: Array<{ suit: string; rank: number; isJoker: boolean }>;
  defending: Array<{ suit: string; rank: number; isJoker: boolean }>;
} | null;

interface GameContextState {
  client: Client | null;
  room: Room<GameState> | null;
  error: string | null;
  isConnected: boolean;
  gameState: GameState | null;
  gameMessage: string | null;
  clearGameMessage: () => void;
  defenseSnapshot: DefenseSnapshot;
  createGame: (options: Record<string, unknown>) => Promise<void>;
  joinGame: (roomId: string) => Promise<void>;
  findPublicGames: () => Promise<RoomAvailable[]>;
  leaveGame: () => void;
}

const GameContext = createContext<GameContextState>({
  client: null,
  room: null,
  error: null,
  isConnected: false,
  gameState: null,
  gameMessage: null,
  clearGameMessage: () => {},
  defenseSnapshot: null,
  createGame: async () => {},
  joinGame: async () => {},
  findPublicGames: async () => [],
  leaveGame: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => useContext(GameContext);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const defaultServerUrl = useMemo(() => {
    // In dev we rely on Vite's proxy so the backend port can change (2567/2568/etc)
    // without changing the client code.
    if (typeof window === 'undefined') return 'ws://localhost:2567';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}/api-ws`;
  }, []);

  // Prefer explicit env var if provided, otherwise use same-origin + Vite proxy
  const client = useMemo(() => {
    const url = import.meta.env.VITE_SERVER_URL || defaultServerUrl;
    return new Client(url);
  }, [defaultServerUrl]);

  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [defenseSnapshot, setDefenseSnapshot] = useState<DefenseSnapshot>(null);
  // Colyseus mutates state in place, so we need a manual tick to trigger React updates
  const [, setTick] = useState(0);
  const gameState = room?.state || null;

  const clearGameMessage = () => setGameMessage(null);

  const handleRoomEvents = (roomInstance: Room<GameState>) => {
    roomInstance.onStateChange(() => setTick(t => t + 1));

    // Issue #80: capture explicit defense snapshot for 5s UI visibility.
    roomInstance.onMessage('defensePlayed', (data: DefenseSnapshot) => {
      setDefenseSnapshot(data);
      // Clear after 10 seconds (client-side display contract)
      if (data?.at) {
        window.setTimeout(() => {
          setDefenseSnapshot((prev) => (prev?.at === data.at ? null : prev));
        }, 10000);
      }
    });

    roomInstance.onMessage('error', (message: string) => {
      setGameMessage(`Error: ${message}`);
      setTimeout(() => setGameMessage(null), 4000);
    });
    roomInstance.onMessage('playerWon', (playerId: string) => {
      setGameMessage(playerId === roomInstance.sessionId ? '🎉 You won!' : `🎉 Player ${playerId} has won!`);
      setTimeout(() => setGameMessage(null), 4000);
    });
    roomInstance.onMessage('gameOver', (data: { loser?: string, draw?: boolean }) => {
      if (data.draw) setGameMessage('Game Over! It is a draw.');
      else setGameMessage(data.loser === roomInstance.sessionId ? '😭 Game Over. You are the Durak (Fool)!' : `🎉 Game Over! ${data.loser} is the Durak.`);
    });
    roomInstance.onMessage('turnExpired', (data: { playerId: string }) => {
      setGameMessage(data.playerId === roomInstance.sessionId ? '⏰ Your time ran out! Skipping your turn...' : '⏰ Turn time expired!');
      setTimeout(() => setGameMessage(null), 3000);
    });
    roomInstance.onError((code, message) => {
      console.error('Room error:', code, message);
      setError(message || 'Unknown room error');
    });
    roomInstance.onLeave((code) => {
      console.log('Left room:', code);
      setIsConnected(false);
      setRoom(null);
    });
    setRoom(roomInstance);
    setIsConnected(true);
    setTick(1);
    setError(null);
  };

  const createGame = async (options: Record<string, unknown>) => {
    try {
      const roomInstance = await client.create<GameState>('durak', options);
      handleRoomEvents(roomInstance);
    } catch (e: unknown) {
      console.error('Error creating room:', e);
      setError(e instanceof Error ? e.message : 'Failed to create room');
    }
  };

  const joinGame = async (roomId: string) => {
    try {
      const roomInstance = await client.joinById<GameState>(roomId);
      handleRoomEvents(roomInstance);
    } catch (e: unknown) {
      console.error('Error joining room:', e);
      setError(e instanceof Error ? e.message : 'Failed to join room');
    }
  };

  const findPublicGames = async () => {
    return await client.getAvailableRooms('durak');
  };

  const leaveGame = () => {
    if (room) {
      room.leave();
    }
  };

  useEffect(() => {
    return () => {
      if (room) room.leave();
    };
  }, [room]);

  return (
    <GameContext.Provider value={{
      client, room, error, isConnected, gameState, gameMessage, clearGameMessage,
      defenseSnapshot,
      createGame, joinGame, findPublicGames, leaveGame
    }}>
      {children}
    </GameContext.Provider>
  );
};
