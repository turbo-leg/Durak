import React, { useEffect, useState } from 'react';

interface ProfileStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  durakCount: number;
}

interface Profile {
  discordId: string;
  username: string;
  avatarUrl: string;
  stats: ProfileStats;
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

interface Props {
  discordId: string;
  avatarUrl: string;
  username: string;
}

const API = '/api';

export const PlayerProfilePanel: React.FC<Props> = ({ discordId, avatarUrl, username }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stats' | 'history'>('stats');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch(`${API}/profile/${discordId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/history/${discordId}?limit=10`).then((r) => (r.ok ? r.json() : [])),
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

  const stats = profile?.stats;
  const winRate =
    stats && stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

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
          <div className="text-indigo-400 text-xs">Discord Player</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['stats', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-xs font-semibold capitalize transition ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-900 text-indigo-300 hover:bg-indigo-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-indigo-400 text-sm text-center py-4 animate-pulse">Loading...</div>
      ) : tab === 'stats' ? (
        stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Games Played" value={stats.gamesPlayed} />
            <StatCard label="Win Rate" value={`${winRate}%`} highlight={winRate >= 50} />
            <StatCard label="Wins" value={stats.wins} highlight />
            <StatCard label="Durak" value={stats.durakCount} dim />
          </div>
        ) : (
          <div className="text-indigo-400 text-sm text-center py-4">
            No stats yet — play a game to get started.
          </div>
        )
      ) : (
        <HistoryList history={history} discordId={discordId} />
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

const HistoryList: React.FC<{ history: MatchRecord[]; discordId: string }> = ({
  history,
  discordId,
}) => {
  if (history.length === 0) {
    return <div className="text-indigo-400 text-sm text-center py-4">No match history yet.</div>;
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {history.map((m) => {
        const won = m.winners.includes(discordId);
        const wasDurak = m.durak === discordId;
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
