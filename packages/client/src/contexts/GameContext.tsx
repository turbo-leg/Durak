import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { Client, Room } from 'colyseus.js';
import type { RoomAvailable } from 'colyseus.js';
import { GameState } from '@durak/shared';

type DefenseSnapshot = {
  at: number;
  defenderId: string;
  attacking: Array<{ suit: string; rank: number; isJoker: boolean }>;
  defending: Array<{ suit: string; rank: number; isJoker: boolean }>;
} | null;

export type SuhuhDraw = { playerId: string; suit: string; rank: number; isJoker: boolean };
export type SuhuhResult = { draws: SuhuhDraw[]; winnerId: string } | null;
export type DiscardedCard = { suit: string; rank: number; isJoker: boolean };

const RECONNECT_TOKEN_KEY = 'durak_reconnection_token';
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS = [500, 2000, 4000]; // ms per attempt

interface GameContextState {
  client: Client | null;
  room: Room<GameState> | null;
  error: string | null;
  isConnected: boolean;
  isReconnecting: boolean;
  isSpectator: boolean;
  gameState: GameState | null;
  gameMessage: string | null;
  clearGameMessage: () => void;
  defenseSnapshot: DefenseSnapshot;
  suhuhResult: SuhuhResult;
  clearSuhuhResult: () => void;
  discardedCards: DiscardedCard[] | null;
  clearDiscardedCards: () => void;
  createGame: (options: Record<string, unknown>) => Promise<void>;
  joinGame: (roomId: string, discordId?: string) => Promise<void>;
  spectateGame: (roomId: string) => Promise<void>;
  findPublicGames: () => Promise<RoomAvailable[]>;
  leaveGame: () => void;
  autoJoinDiscordRoom: (
    instanceId: string,
    username: string,
    avatarUrl: string,
    discordId?: string,
  ) => Promise<void>;
  updateLobbySettings: (settings: Partial<GameState>) => void;
  startLobbyGame: () => void;
  serverTimeOffset: number;
}

const GameContext = createContext<GameContextState>({
  client: null,
  room: null,
  error: null,
  isConnected: false,
  isReconnecting: false,
  isSpectator: false,
  gameState: null,
  gameMessage: null,
  clearGameMessage: () => {},
  defenseSnapshot: null,
  suhuhResult: null,
  clearSuhuhResult: () => {},
  discardedCards: null,
  clearDiscardedCards: () => {},
  createGame: async () => {},
  joinGame: async () => {},
  spectateGame: async () => {},
  findPublicGames: async () => [],
  leaveGame: () => {},
  autoJoinDiscordRoom: async () => {},
  updateLobbySettings: () => {},
  startLobbyGame: () => {},
  serverTimeOffset: 0,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => useContext(GameContext);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const defaultServerUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'ws://localhost:2567';

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Vite dev server runs on 5173 and proxies /api-ws to Colyseus.
    if (window.location.port === '5173') {
      return `${wsProtocol}//${window.location.host}/api-ws`;
    }

    // When the app is served by the server container itself (Docker / production),
    // connect directly to the same origin instead of going through the Vite proxy.
    return `${wsProtocol}//${window.location.host}`;
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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [defenseSnapshot, setDefenseSnapshot] = useState<DefenseSnapshot>(null);
  const [suhuhResult, setSuhuhResult] = useState<SuhuhResult>(null);
  const [discardedCards, setDiscardedCards] = useState<DiscardedCard[] | null>(null);
  const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  // Colyseus mutates state in place, so we need a manual tick to trigger React updates
  const [, setTick] = useState(0);
  const gameState = room?.state || null;

  // Stable ref so onLeave can access the latest client without a stale closure
  const clientRef = useRef(client);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  // Stable ref so the onLeave closure can read current spectator state
  const isSpectatorRef = useRef(false);
  useEffect(() => {
    isSpectatorRef.current = isSpectator;
  }, [isSpectator]);

  const clearGameMessage = () => setGameMessage(null);
  const clearSuhuhResult = () => setSuhuhResult(null);
  const clearDiscardedCards = () => {
    if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
    setDiscardedCards(null);
  };

  const attemptReconnect = async () => {
    const token = sessionStorage.getItem(RECONNECT_TOKEN_KEY);
    if (!token) return false;

    setIsReconnecting(true);
    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
      await new Promise((res) => setTimeout(res, RECONNECT_DELAYS[i]));
      try {
        const newRoom = await clientRef.current.reconnect<GameState>(token);
        handleRoomEvents(newRoom);
        setIsReconnecting(false);
        return true;
      } catch {
        // continue to next attempt
      }
    }

    // All attempts exhausted
    sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
    setIsReconnecting(false);
    return false;
  };

  const handleRoomEvents = (roomInstance: Room<GameState>) => {
    // Persist token so the client can reconnect after a network drop or page refresh
    if (roomInstance.reconnectionToken) {
      sessionStorage.setItem(RECONNECT_TOKEN_KEY, roomInstance.reconnectionToken);
    }

    roomInstance.onStateChange(() => setTick((t) => t + 1));

    // Calculate server time offset
    roomInstance.onMessage('pong', (data: { clientTime: number; serverTime: number }) => {
      const now = Date.now();
      const latency = (now - data.clientTime) / 2;
      const offset = data.serverTime - data.clientTime - latency;
      setServerTimeOffset(offset);
    });

    // Request a ping immediately to sync clocks
    roomInstance.send('ping', { clientTime: Date.now() });

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

    roomInstance.onMessage('clearDefenseSnapshot', () => {
      setDefenseSnapshot(null);
    });

    roomInstance.onMessage('roundDiscarded', (data: { cards: DiscardedCard[] }) => {
      if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
      setDiscardedCards(data.cards);
      discardTimerRef.current = setTimeout(() => setDiscardedCards(null), 2500);
    });

    roomInstance.onMessage('suhuhResult', (data: { draws: SuhuhDraw[]; winnerId: string }) => {
      setSuhuhResult(data);
    });

    roomInstance.onMessage('error', (message: string) => {
      setGameMessage(`Error: ${message}`);
      setTimeout(() => setGameMessage(null), 4000);
    });
    roomInstance.onMessage('playerWon', (playerId: string) => {
      setGameMessage(
        playerId === roomInstance.sessionId ? '🎉 You won!' : `🎉 Player ${playerId} has won!`,
      );
      setTimeout(() => setGameMessage(null), 4000);
    });
    roomInstance.onMessage('gameOver', (data: { loser?: string; draw?: boolean }) => {
      if (data.draw) setGameMessage('Game Over! It is a draw.');
      else
        setGameMessage(
          data.loser === roomInstance.sessionId
            ? '😭 Game Over. You are the Durak (Fool)!'
            : `🎉 Game Over! ${data.loser} is the Durak.`,
        );
      // Game is over — no reconnection needed after this point
      sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
    });
    roomInstance.onMessage('turnExpired', (data: { playerId: string }) => {
      setGameMessage(
        data.playerId === roomInstance.sessionId
          ? '⏰ Your time ran out! Skipping your turn...'
          : '⏰ Turn time expired!',
      );
      setTimeout(() => setGameMessage(null), 3000);
    });
    roomInstance.onError((code, message) => {
      console.error('Room error:', code, message);
      setError(message || 'Unknown room error');
    });
    roomInstance.onLeave(async (code) => {
      console.log('Left room:', code);
      setIsConnected(false);
      setRoom(null);
      setSuhuhResult(null);

      // Spectators don't have a reconnection token and don't need reconnect logic
      if (isSpectatorRef.current) {
        setIsSpectator(false);
        return;
      }

      // WebSocket close codes: 1000 = normal, 4000+ = room-level consented closes.
      // Anything else is an unexpected drop — try to reconnect.
      const isCleanExit = code === 1000 || code >= 4000;
      if (!isCleanExit) {
        const reconnected = await attemptReconnect();
        if (reconnected) return;
      }

      sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
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

  const joinGame = async (roomId: string, discordId?: string) => {
    try {
      const roomInstance = await client.joinById<GameState>(roomId, discordId ? { discordId } : {});
      handleRoomEvents(roomInstance);
    } catch (e: unknown) {
      console.error('Error joining room:', e);
      setError(e instanceof Error ? e.message : 'Failed to join room');
    }
  };

  const spectateGame = async (roomId: string) => {
    try {
      const roomInstance = await client.joinById<GameState>(roomId, { spectator: true });
      setIsSpectator(true);
      handleRoomEvents(roomInstance);
    } catch (e: unknown) {
      console.error('Error spectating room:', e);
      setError(e instanceof Error ? e.message : 'Failed to spectate game');
    }
  };

  const findPublicGames = async () => {
    return await client.getAvailableRooms('durak');
  };

  const autoJoinDiscordRoom = async (
    discordInstanceId: string,
    username: string,
    avatarUrl: string,
    discordId?: string,
  ) => {
    try {
      const roomInstance = await client.joinOrCreate<GameState>('durak', {
        discordInstanceId,
        username,
        avatarUrl,
        ...(discordId ? { discordId } : {}),
      });
      handleRoomEvents(roomInstance);
    } catch (e: unknown) {
      console.error('Error auto-joining Discord room:', e);
      setError(e instanceof Error ? e.message : 'Failed to auto-join Discord room');
    }
  };

  const leaveGame = () => {
    if (room) {
      sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
      setIsSpectator(false);
      room.leave();
    }
  };

  const updateLobbySettings = (settings: Partial<GameState>) => {
    if (room && room.state.phase === 'waiting') {
      room.send('updateSettings', settings);
    }
  };

  const startLobbyGame = () => {
    if (room && room.state.phase === 'waiting') {
      room.send('startGame');
    }
  };

  // On mount: if there's a saved reconnection token (e.g. after a page refresh), restore session
  useEffect(() => {
    if (sessionStorage.getItem(RECONNECT_TOKEN_KEY)) {
      attemptReconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (room) room.leave();
    };
  }, [room]);

  return (
    <GameContext.Provider
      value={{
        client,
        room,
        error,
        isConnected,
        isReconnecting,
        isSpectator,
        gameState,
        gameMessage,
        clearGameMessage,
        defenseSnapshot,
        suhuhResult,
        clearSuhuhResult,
        discardedCards,
        clearDiscardedCards,
        createGame,
        joinGame,
        spectateGame,
        findPublicGames,
        leaveGame,
        autoJoinDiscordRoom,
        updateLobbySettings,
        startLobbyGame,
        serverTimeOffset,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
