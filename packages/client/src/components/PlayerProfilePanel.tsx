import React, { useEffect, useState } from 'react';

interface ProfileStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  durakCount: number;
}

interface Profile {
  _id: string;
  discordId: string;
  username: string;
  avatarUrl: string;
  stats: ProfileStats;
  eloClassic: number;
  eloTeams: number;
  updatedAt: string;
}

interface MatchRecord {
  _id: string;
  roomId: string;
  date: string;
  mode: string;
  discordIds: string[];
  winners: string[];
  durak: string | null;
}

interface LeaderEntry {
  _id: string;
  username: string;
  avatarUrl: string;
  eloClassic: number;
  eloTeams: number;
  stats: { gamesPlayed: number };
}

interface Props {
  discordId?: string;
  userId?: string;
  avatarUrl: string;
  username: string;
}

const API = '/api';

export const PlayerProfilePanel: React.FC<Props> = ({ discordId, userId, avatarUrl, username }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stats' | 'history' | 'leaderboard'>('stats');
  const [leaderMode, setLeaderMode] = useState<'classic' | 'teams'>('classic');

  const id = discordId ?? userId ?? '';
  const byParam = userId && !discordId ? '&by=user' : '';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([
      fetch(`${API}/profile/${id}?${byParam.slice(1)}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/history/${id}?limit=10${byParam}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([prof, hist]) => {
        if (cancelled) return;
        setProfile(prof);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [discordId]);

  useEffect(() => {
    if (tab !== 'leaderboard') return;
    let cancelled = false;
    fetch(`${API}/leaderboard?mode=${leaderMode}&limit=10`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setLeaders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLeaders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, leaderMode]);

  const stats = profile?.stats;
  const winRate =
    stats && stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const elo = profile?.eloClassic ?? 1000;

  return (
    <div className="bg-indigo-950 border border-indigo-700 rounded-xl p-5 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="w-12 h-12 rounded-full border-2 border-indigo-400"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-indigo-700 flex items-center justify-center text-xl font-bold border-2 border-indigo-400">
            {username.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-bold text-lg leading-tight">{username}</div>
          {profile && (
            <div className="text-yellow-400 text-xs font-semibold">
              ★ {elo} <span className="text-indigo-400 font-normal">ELO</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['stats', 'history', 'leaderboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-xs font-semibold capitalize transition ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-900 text-indigo-300 hover:bg-indigo-800'
            }`}
          >
            {t === 'leaderboard' ? '🏆' : t}
          </button>
        ))}
      </div>

      {loading && tab !== 'leaderboard' ? (
        <div className="text-indigo-400 text-sm text-center py-4 animate-pulse">Loading...</div>
      ) : tab === 'stats' ? (
        stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Games Played" value={stats.gamesPlayed} />
            <StatCard label="Win Rate" value={`${winRate}%`} highlight={winRate >= 50} />
            <StatCard label="Wins" value={stats.wins} highlight />
            <StatCard label="Durak" value={stats.durakCount} dim />
            <div className="col-span-2 bg-indigo-900/60 rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="text-yellow-400 font-bold text-xl">
                  ★ {profile?.eloClassic ?? 1000}
                </div>
                <div className="text-indigo-400 text-xs mt-0.5">Classic ELO</div>
              </div>
              <div className="text-right">
                <div className="text-yellow-400 font-bold text-xl">
                  ★ {profile?.eloTeams ?? 1000}
                </div>
                <div className="text-indigo-400 text-xs mt-0.5">Teams ELO</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-indigo-400 text-sm text-center py-4">
            No stats yet — play a game to get started.
          </div>
        )
      ) : tab === 'history' ? (
        <HistoryList history={history} playerId={id} />
      ) : (
        <LeaderboardList
          leaders={leaders}
          mode={leaderMode}
          onModeChange={setLeaderMode}
          myProfileId={profile?._id}
        />
      )}
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  highlight?: boolean;
  dim?: boolean;
}> = ({ label, value, highlight, dim }) => (
  <div className="bg-indigo-900/60 rounded-lg p-3 text-center">
    <div
      className={`text-2xl font-bold ${highlight ? 'text-green-400' : dim ? 'text-red-400' : 'text-white'}`}
    >
      {value}
    </div>
    <div className="text-indigo-400 text-xs mt-1">{label}</div>
  </div>
);

const HistoryList: React.FC<{ history: MatchRecord[]; playerId: string }> = ({
  history,
  playerId,
}) => {
  if (history.length === 0) {
    return <div className="text-indigo-400 text-sm text-center py-4">No match history yet.</div>;
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {history.map((m) => {
        const won = m.winners.includes(playerId);
        const wasDurak = m.durak === playerId;
        const result = won ? 'Win' : wasDurak ? 'Durak' : 'Loss';
        const resultColor = won ? 'text-green-400' : wasDurak ? 'text-red-400' : 'text-yellow-400';
        const date = new Date(m.date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });

        return (
          <div
            key={m._id}
            className="flex items-center justify-between bg-indigo-900/50 rounded px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className={`font-bold ${resultColor}`}>{result}</span>
              <span className="text-indigo-400 capitalize">{m.mode}</span>
            </div>
            <div className="text-indigo-500">{date}</div>
          </div>
        );
      })}
    </div>
  );
};

const LeaderboardList: React.FC<{
  leaders: LeaderEntry[];
  mode: 'classic' | 'teams';
  onModeChange: (m: 'classic' | 'teams') => void;
  myProfileId?: string;
}> = ({ leaders, mode, onModeChange, myProfileId }) => (
  <div>
    <div className="flex gap-2 mb-3">
      {(['classic', 'teams'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={`px-3 py-1 rounded text-xs font-semibold capitalize transition ${
            mode === m
              ? 'bg-yellow-600 text-white'
              : 'bg-indigo-900 text-indigo-300 hover:bg-indigo-800'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
    {leaders.length === 0 ? (
      <div className="text-indigo-400 text-sm text-center py-4">No ranked players yet.</div>
    ) : (
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {leaders.map((p, i) => {
          const elo = mode === 'classic' ? p.eloClassic : p.eloTeams;
          const isMe = !!myProfileId && p._id === myProfileId;
          return (
            <div
              key={p._id}
              className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${
                isMe ? 'bg-yellow-900/40 border border-yellow-700' : 'bg-indigo-900/50'
              }`}
            >
              <span className="text-indigo-500 w-4 text-right shrink-0">{i + 1}</span>
              <span className="flex-1 font-semibold truncate">{p.username}</span>
              <span className="text-yellow-400 font-bold">★ {elo}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
