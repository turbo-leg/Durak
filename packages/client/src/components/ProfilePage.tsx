import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BADGES } from '@durak/shared';

interface ProfileStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  durakCount: number;
  winStreak: number;
  durakFreeStreak: number;
}

interface Profile {
  _id: string;
  username: string;
  avatarUrl: string;
  stats: ProfileStats;
  eloClassic: number;
  eloTeams: number;
  badges: string[];
  coins: number;
}

interface MatchRecord {
  _id: string;
  roomId: string;
  date: string;
  mode: string;
  discordIds: string[];
  userIds: string[];
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

const API = '/api';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [tab, setTab] = useState<'stats' | 'history' | 'leaderboard'>('stats');
  const [leaderMode, setLeaderMode] = useState<'classic' | 'teams'>('classic');
  const [loading, setLoading] = useState(!!user?.id);

  const id = user?.id ?? '';
  const byParam = user?.method === 'email' ? '?by=user' : '';

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      fetch(`${API}/profile/${id}${byParam}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/history/${id}?limit=20${byParam ? '&by=user' : ''}`).then((r) =>
        r.ok ? r.json() : [],
      ),
    ])
      .then(([prof, hist]) => {
        setProfile(prof);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [id, byParam]);

  useEffect(() => {
    if (tab !== 'leaderboard') return;
    fetch(`${API}/leaderboard?mode=${leaderMode}&limit=20`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLeaders(Array.isArray(d) ? d : []))
      .catch(() => setLeaders([]));
  }, [tab, leaderMode]);

  if (!user) {
    return (
      <div className="min-h-screen bg-indigo-950 text-white flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-5xl">♠</div>
        <p className="text-indigo-300 text-center">Sign in to view your profile and stats.</p>
      </div>
    );
  }

  const stats = profile?.stats;
  const winRate = stats?.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="min-h-screen bg-indigo-950 text-white pb-24">
      {/* Header card */}
      <div className="bg-gradient-to-b from-indigo-900 to-indigo-950 px-6 pt-8 pb-6 border-b border-indigo-800">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-16 h-16 rounded-full border-2 border-indigo-400 object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-700 border-2 border-indigo-400 flex items-center justify-center text-2xl font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-xl leading-tight truncate">{user.username}</div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-yellow-400 text-sm font-semibold">
                ★ {profile?.eloClassic ?? 1000} ELO
              </span>
              {profile && (
                <span className="text-yellow-300 text-sm font-semibold flex items-center gap-1">
                  🪙 {(profile.coins ?? 0).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-indigo-400 hover:text-red-400 transition font-semibold shrink-0"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {(['stats', 'history', 'leaderboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2">
        {loading ? (
          <div className="text-indigo-400 text-sm text-center py-12 animate-pulse">Loading…</div>
        ) : tab === 'stats' ? (
          stats ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Games" value={stats.gamesPlayed} />
                <StatCard label="Win Rate" value={`${winRate}%`} highlight={winRate >= 50} />
                <StatCard label="Wins" value={stats.wins} highlight />
                <StatCard label="Durak" value={stats.durakCount} dim />
                <StatCard
                  label="Win Streak"
                  value={stats.winStreak}
                  highlight={stats.winStreak >= 3}
                />
                <StatCard label="Clean Streak" value={stats.durakFreeStreak} />
              </div>
              <div className="bg-indigo-900/60 rounded-xl p-4 flex justify-between">
                <div>
                  <div className="text-yellow-400 font-bold text-2xl">
                    ★ {profile?.eloClassic ?? 1000}
                  </div>
                  <div className="text-indigo-400 text-xs mt-0.5">Classic ELO</div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-bold text-2xl">
                    ★ {profile?.eloTeams ?? 1000}
                  </div>
                  <div className="text-indigo-400 text-xs mt-0.5">Teams ELO</div>
                </div>
              </div>
              <BadgesSection earned={profile?.badges ?? []} />
            </div>
          ) : (
            <div className="text-indigo-400 text-sm text-center py-12">
              No stats yet — play a game to get started.
            </div>
          )
        ) : tab === 'history' ? (
          <HistoryList history={history} byUser={user.method === 'email'} />
        ) : (
          <LeaderboardSection
            leaders={leaders}
            mode={leaderMode}
            onModeChange={setLeaderMode}
            myProfileId={profile?._id}
          />
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  highlight?: boolean;
  dim?: boolean;
}> = ({ label, value, highlight, dim }) => (
  <div className="bg-indigo-900/60 rounded-xl p-4 text-center">
    <div
      className={`text-2xl font-bold ${highlight ? 'text-green-400' : dim ? 'text-red-400' : 'text-white'}`}
    >
      {value}
    </div>
    <div className="text-indigo-400 text-xs mt-1">{label}</div>
  </div>
);

const BadgesSection: React.FC<{ earned: string[] }> = ({ earned }) => {
  const earnedBadges = BADGES.filter((b) => earned.includes(b.id));
  if (earnedBadges.length === 0) return null;
  return (
    <div className="bg-indigo-900/60 rounded-xl p-4">
      <div className="text-indigo-400 text-xs mb-2 font-semibold uppercase tracking-wide">
        Badges
      </div>
      <div className="flex flex-wrap gap-2">
        {earnedBadges.map((b) => (
          <span
            key={b.id}
            title={b.description}
            className="inline-flex items-center gap-1.5 bg-indigo-800/70 border border-indigo-600 rounded-full px-3 py-1 text-sm font-semibold"
          >
            {b.emoji} {b.name}
          </span>
        ))}
      </div>
    </div>
  );
};

const HistoryList: React.FC<{
  history: MatchRecord[];
  byUser: boolean;
}> = ({ history, byUser }) => {
  if (history.length === 0) {
    return <div className="text-indigo-400 text-sm text-center py-12">No match history yet.</div>;
  }
  return (
    <div className="space-y-2">
      {history.map((m) => {
        const myIds = byUser ? m.userIds : m.discordIds;
        const won = m.winners.some((w) => myIds.includes(w));
        const wasDurak = myIds.includes(m.durak ?? '');
        const result = won ? 'Win' : wasDurak ? 'Durak' : 'Loss';
        const color = won ? 'text-green-400' : wasDurak ? 'text-red-400' : 'text-yellow-400';
        const date = new Date(m.date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        return (
          <div
            key={m._id}
            className="flex items-center justify-between bg-indigo-900/50 rounded-lg px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className={`font-bold ${color}`}>{result}</span>
              <span className="text-indigo-400 capitalize">{m.mode}</span>
            </div>
            <span className="text-indigo-500 text-xs">{date}</span>
          </div>
        );
      })}
    </div>
  );
};

const LeaderboardSection: React.FC<{
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
          className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition ${
            mode === m
              ? 'bg-yellow-600 text-white'
              : 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
    {leaders.length === 0 ? (
      <div className="text-indigo-400 text-sm text-center py-12">No ranked players yet.</div>
    ) : (
      <div className="space-y-1.5">
        {leaders.map((p, i) => {
          const elo = mode === 'classic' ? p.eloClassic : p.eloTeams;
          const isMe = !!myProfileId && p._id === myProfileId;
          return (
            <div
              key={p._id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
                isMe ? 'bg-yellow-900/40 border border-yellow-700' : 'bg-indigo-900/50'
              }`}
            >
              <span className="text-indigo-500 w-5 text-right font-mono text-xs">{i + 1}</span>
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.username}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold">
                  {p.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 font-semibold truncate">{p.username}</span>
              <span className="text-yellow-400 font-bold">★ {elo}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
