import React, { useEffect, useState } from 'react';
import type { RoomAvailable } from 'colyseus.js';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';

export const PublicLobby: React.FC = () => {
  const { findPublicGames, joinGame, createGame } = useGame();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const fetchRooms = async () => {
    try {
      const available = await findPublicGames();
      setRooms(available);
    } catch (e) {
      console.error('Failed to fetch public games', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
    const interval = setInterval(() => void fetchRooms(), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoin = async (roomId: string) => {
    setJoining(true);
    await joinGame(
      roomId,
      user?.method === 'discord' ? user.id : undefined,
      user?.method === 'email' ? user.id : undefined,
    );
    setJoining(false);
  };

  const handleCreate = async () => {
    setJoining(true);
    await createGame({ isPublic: true, isPrivate: false, mode: 'classic' });
    setJoining(false);
  };

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex flex-col safe-p">
      <header className="px-6 pt-8 pb-4 border-b border-indigo-800">
        <h1 className="text-2xl font-extrabold tracking-tight">
          ♦ Durak <span className="text-yellow-400">Online</span>
        </h1>
        <p className="text-indigo-300 text-sm mt-1">Find a public game or create one</p>
      </header>

      <main className="flex-1 flex flex-col px-4 py-6 gap-4 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-indigo-100">Public Games</h2>
          <button
            onClick={() => {
              setLoading(true);
              void fetchRooms();
            }}
            className="text-indigo-400 hover:text-indigo-200 text-sm transition"
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-indigo-300 text-base">No games found.</p>
            <p className="text-indigo-400 text-sm">Create one and let others join!</p>
            <button
              onClick={handleCreate}
              disabled={joining}
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition"
            >
              {joining ? 'Creating…' : 'Create Public Game'}
            </button>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {rooms.map((r) => {
                const meta = r.metadata as Record<string, unknown> | null;
                const playerCount = (meta?.playerCount as number) ?? r.clients;
                const maxPlayers = (meta?.maxPlayers as number) ?? r.maxClients;
                const isFull = playerCount >= maxPlayers;
                const gameMode = (meta?.mode as string) === 'teams' ? 'Teams' : 'Classic';
                return (
                  <li
                    key={r.roomId}
                    className="bg-indigo-900/60 border border-indigo-700 rounded-xl p-4 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-bold text-white">Room {r.roomId.substring(0, 6)}…</div>
                      <div className="text-sm text-indigo-300 mt-0.5">
                        {gameMode} · {playerCount}/{maxPlayers} players
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoin(r.roomId)}
                      disabled={joining || isFull}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-2 px-5 rounded-lg text-sm transition"
                    >
                      {isFull ? 'Full' : 'Join'}
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              onClick={handleCreate}
              disabled={joining}
              className="mt-2 w-full bg-indigo-700/50 hover:bg-indigo-700 border border-indigo-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition"
            >
              {joining ? 'Creating…' : '+ Create Public Game'}
            </button>
          </>
        )}
      </main>
    </div>
  );
};
