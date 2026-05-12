import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import type { RoomAvailable } from 'colyseus.js';
import { PlayerProfilePanel } from './PlayerProfilePanel';

const getAvailablePlayers = (mode: string) => {
  return mode === 'teams' ? [4, 6] : [2, 3, 4, 5, 6];
};

const getAvailableHandSizes = (mode: string, players: number) => {
  if (mode === 'teams') {
    return players === 4 ? [7] : [5];
  } else {
    return players <= 4 ? [5, 7] : [5];
  }
};

interface LobbyProps {
  discordId?: string;
  username?: string;
  avatarUrl?: string;
}

export const Lobby: React.FC<LobbyProps> = ({ discordId, username = '', avatarUrl = '' }) => {
  const { createGame, joinGame, spectateGame, findPublicGames, error } = useGame();

  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form options
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mode, setMode] = useState('classic');
  const [teamSelection, setTeamSelection] = useState<'random' | 'manual'>('random');
  const [handSize, setHandSize] = useState(5);

  const fetchRooms = async () => {
    try {
      const publicRooms = await findPublicGames();
      setRooms(publicRooms);
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(() => {
      void fetchRooms();
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await createGame({ maxPlayers, isPrivate, mode, teamSelection, handSize });
    setIsLoading(false);
  };

  const handleJoinById = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsLoading(true);
    await joinGame(joinCode.trim(), discordId);
    setIsLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 text-black relative z-20">
      {/* Profile panel spans full width when discordId is available */}
      {discordId && (
        <div className="col-span-full">
          <PlayerProfilePanel discordId={discordId} username={username} avatarUrl={avatarUrl} />
        </div>
      )}
      {/* Create Room Panel */}
      <div className="bg-green-100 p-8 rounded-xl shadow-lg border border-green-300">
        <h2 className="text-2xl font-bold text-green-900 mb-6">Create New Game</h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-green-800 mb-1">Game Mode</label>
            <select
              value={mode}
              onChange={(e) => {
                const newMode = e.target.value;
                setMode(newMode);
                const validPlayers = getAvailablePlayers(newMode);
                let newPlayers = maxPlayers;
                if (!validPlayers.includes(newPlayers)) {
                  newPlayers = validPlayers[0];
                  setMaxPlayers(newPlayers);
                }
                const validHandSizes = getAvailableHandSizes(newMode, newPlayers);
                if (!validHandSizes.includes(handSize)) {
                  setHandSize(validHandSizes[0]);
                }
              }}
              className="w-full p-2 border border-green-400 rounded-md bg-white"
            >
              <option value="classic">Classic (Free for All)</option>
              <option value="teams">Teams (3v3 / 2v2)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-green-800 mb-1">Max Players</label>
            <select
              value={maxPlayers}
              onChange={(e) => {
                const num = parseInt(e.target.value);
                setMaxPlayers(num);
                const validHandSizes = getAvailableHandSizes(mode, num);
                if (!validHandSizes.includes(handSize)) {
                  setHandSize(validHandSizes[0]);
                }
              }}
              className="w-full p-2 border border-green-400 rounded-md bg-white"
            >
              {getAvailablePlayers(mode).map((num) => (
                <option key={num} value={num}>
                  {num} Players
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-green-800 mb-1">Cards in Hand</label>
            <select
              value={handSize}
              onChange={(e) => setHandSize(parseInt(e.target.value))}
              className="w-full p-2 border border-green-400 rounded-md bg-white"
              disabled={getAvailableHandSizes(mode, maxPlayers).length <= 1}
            >
              {getAvailableHandSizes(mode, maxPlayers).map((size) => (
                <option key={size} value={size}>
                  {size} Cards
                </option>
              ))}
            </select>
            {getAvailableHandSizes(mode, maxPlayers).length <= 1 && (
              <p className="text-xs text-green-700 mt-1">
                Hand size is locked to {getAvailableHandSizes(mode, maxPlayers)[0]} for this
                mode/player count.
              </p>
            )}
          </div>

          {mode === 'teams' && (
            <div>
              <label className="block text-sm font-bold text-green-800 mb-1">Team Assignment</label>
              <select
                value={teamSelection}
                onChange={(e) => setTeamSelection(e.target.value as 'random' | 'manual')}
                className="w-full p-2 border border-green-400 rounded-md bg-white"
              >
                <option value="random">Randomize Teams</option>
                <option value="manual">Manual Selection</option>
              </select>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-5 h-5 text-green-600 border-green-400 rounded focus:ring-green-500"
            />
            <label htmlFor="isPrivate" className="font-bold text-green-900 cursor-pointer">
              Private Game (Hidden from Lobby)
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow disabled:opacity-50 transition"
          >
            {isLoading ? 'Creating...' : 'Create & Join Game'}
          </button>
        </form>
      </div>

      {/* Join Room Panel */}
      <div className="flex flex-col space-y-6">
        {/* Join by Code */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Join Private Game</h2>
          <form onSubmit={handleJoinById} className="flex space-x-2">
            <input
              type="text"
              placeholder="Enter Room Code (e.g. A1B2)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-md focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !joinCode.trim()}
              className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-6 rounded-md disabled:opacity-50 transition"
            >
              Join
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600 font-semibold">{error}</p>}
        </div>

        {/* Public Rooms */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-gray-800">Public Lobbies</h2>
            <button onClick={fetchRooms} className="text-sm text-green-600 hover:underline">
              ↻ Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] border border-gray-100 rounded-lg">
            {rooms.length === 0 ? (
              <div className="h-full flex items-center justify-center p-8 text-gray-500 text-center">
                No public games available.
                <br />
                Create one to get started!
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rooms.map((r) => {
                  const meta = r.metadata as Record<string, unknown> | null;
                  const playerCount = (meta?.playerCount as number) ?? r.clients;
                  const maxPlayers = (meta?.maxPlayers as number) ?? r.maxClients;
                  const spectatorCount = (meta?.spectatorCount as number) ?? 0;
                  const phase = (meta?.phase as string) ?? 'waiting';
                  const isFull = playerCount >= maxPlayers;
                  const canWatch = phase === 'playing';
                  return (
                    <li
                      key={r.roomId}
                      className="p-4 hover:bg-green-50 transition flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-gray-800">
                          Room {r.roomId.substring(0, 6)}...
                        </div>
                        <div className="text-sm text-gray-500">
                          {playerCount} / {maxPlayers} Players •{' '}
                          {meta?.mode === 'teams' ? 'Teams' : 'Classic'}
                          {spectatorCount > 0 && (
                            <span className="ml-2 text-purple-500">👁 {spectatorCount}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => joinGame(r.roomId, discordId)}
                          disabled={isLoading || isFull}
                          className="bg-green-100 text-green-800 hover:bg-green-200 font-bold px-4 py-2 rounded text-sm transition disabled:opacity-50"
                        >
                          Join
                        </button>
                        <button
                          onClick={() => spectateGame(r.roomId)}
                          disabled={isLoading || !canWatch}
                          title={!canWatch ? 'Game has not started yet' : undefined}
                          className="bg-purple-100 text-purple-800 hover:bg-purple-200 font-bold px-3 py-2 rounded text-sm transition disabled:opacity-50"
                        >
                          Watch
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
