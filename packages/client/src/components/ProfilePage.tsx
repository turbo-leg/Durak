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
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div
          className="text-6xl font-display text-[var(--gold-400)] drop-shadow-[0_2px_8px_rgba(212,175,55,0.4)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ♠
        </div>
        <p className="text-[var(--ivory-200)] font-semibold tracking-wide">
          Sign in to view your profile and stats.
        </p>
      </div>
    );
  }

  const stats = profile?.stats;
  const winRate = stats?.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="min-h-screen bg-transparent text-white pb-24">
      {/* Header card */}
      <div className="bg-gradient-to-b from-[#07261a] to-transparent px-6 pt-8 pb-6 border-b border-[rgba(212,175,55,0.22)] backdrop-blur-md">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-16 h-16 rounded-full border-2 border-[var(--gold-400)] object-cover shadow-[var(--gold-glow)]"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--gradient-velvet)] border-2 border-[var(--gold-400)] flex items-center justify-center text-2xl font-black text-[var(--gold-300)] shadow-[var(--gold-glow)]">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div
              className="font-black text-xl leading-tight truncate text-[var(--ivory-50)] tracking-wide font-display"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {user.username}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[var(--gold-400)] text-sm font-bold tracking-wider">
                ★ {profile?.eloClassic ?? 1000} ELO
              </span>
              {profile && (
                <span className="text-[var(--gold-300)] text-sm font-bold flex items-center gap-1.5 tracking-wider">
                  <img
                    src="/assets/coin.png"
                    alt="coins"
                    style={{
                      width: 18,
                      height: 18,
                      objectFit: 'contain',
                      display: 'inline-block',
                      verticalAlign: 'middle',
                      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
                    }}
                  />
                  <span>{(profile.coins ?? 0).toLocaleString()}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-[var(--gold-400)] hover:text-red-400 transition font-black uppercase tracking-widest cursor-pointer shrink-0"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 mx-4 mt-6 rounded-xl bg-black/45 border border-[rgba(212,175,55,0.15)] shadow-inner">
        {(['stats', 'history', 'leaderboard'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition duration-150 border-none cursor-pointer ${
                active
                  ? 'bg-[var(--gradient-gold)] text-[var(--ink-900)] shadow-md font-extrabold'
                  : 'bg-transparent text-[var(--ivory-300)] hover:text-white'
              }`}
              style={{
                fontFamily: 'var(--font-display)',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="text-[var(--gold-400)] text-sm text-center py-12 animate-pulse font-bold tracking-widest">
            LOADING PLAYER CARD…
          </div>
        ) : tab === 'stats' ? (
          stats ? (
            <div className="space-y-4">
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
              <div className="casino-panel p-4 flex justify-between border-[rgba(212,175,55,0.22)]">
                <div>
                  <div
                    className="text-[var(--gold-400)] font-black text-2xl font-display"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    ★ {profile?.eloClassic ?? 1000}
                  </div>
                  <div className="text-[var(--ivory-300)] text-[10px] font-bold uppercase tracking-widest mt-1 opacity-75">
                    Classic ELO
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-[var(--gold-400)] font-black text-2xl font-display"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    ★ {profile?.eloTeams ?? 1000}
                  </div>
                  <div className="text-[var(--ivory-300)] text-[10px] font-bold uppercase tracking-widest mt-1 opacity-75">
                    Teams ELO
                  </div>
                </div>
              </div>
              <BadgesSection earned={profile?.badges ?? []} />
            </div>
          ) : (
            <div className="text-[var(--ivory-300)] text-sm text-center py-12 italic opacity-60">
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
  <div className="casino-panel p-4 text-center border-[rgba(212,175,55,0.18)]">
    <div
      className={`text-2xl font-black font-display tracking-wider ${
        highlight ? 'text-emerald-400' : dim ? 'text-red-400' : 'text-[var(--gold-300)]'
      }`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {value}
    </div>
    <div className="text-[var(--ivory-200)] text-[9px] font-bold uppercase tracking-widest mt-1.5 opacity-75">
      {label}
    </div>
  </div>
);

const BadgesSection: React.FC<{ earned: string[] }> = ({ earned }) => {
  const earnedBadges = BADGES.filter((b) => earned.includes(b.id));
  if (earnedBadges.length === 0) return null;
  return (
    <div className="casino-panel p-4 border-[rgba(212,175,55,0.22)]">
      <div
        className="text-[var(--gold-400)] text-[10px] mb-3 font-bold uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Earned Badges
      </div>
      <div className="flex flex-wrap gap-2">
        {earnedBadges.map((b) => (
          <span
            key={b.id}
            title={b.description}
            className="inline-flex items-center gap-1.5 bg-[var(--gradient-velvet)] border border-[rgba(212,175,55,0.35)] rounded-full px-3.5 py-1.5 text-xs font-bold text-[var(--ivory-50)] shadow-md"
          >
            <span>{b.emoji}</span> <span>{b.name}</span>
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
    return (
      <div className="text-[var(--ivory-300)] text-sm text-center py-12 italic opacity-60">
        No match history yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {history.map((m) => {
        const myIds = byUser ? m.userIds : m.discordIds;
        const won = m.winners.some((w) => myIds.includes(w));
        const wasDurak = myIds.includes(m.durak ?? '');
        const result = won ? 'Win' : wasDurak ? 'Durak' : 'Loss';
        const color = won
          ? 'text-emerald-400'
          : wasDurak
            ? 'text-red-400'
            : 'text-[var(--gold-400)]';
        const date = new Date(m.date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        return (
          <div
            key={m._id}
            className="flex items-center justify-between casino-panel border-[rgba(212,175,55,0.15)] px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className={`font-black uppercase tracking-wider text-xs ${color}`}>
                {result}
              </span>
              <span className="text-[var(--ivory-200)] capitalize font-semibold">
                {m.mode} Mode
              </span>
            </div>
            <span className="text-[var(--ivory-300)] text-xs opacity-75">{date}</span>
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
    <div className="flex gap-1.5 p-1 bg-black/45 border border-[rgba(212,175,55,0.15)] rounded-lg mb-4">
      {(['classic', 'teams'] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition border-none cursor-pointer ${
              active
                ? 'bg-[var(--gradient-gold)] text-[var(--ink-900)] font-extrabold shadow-sm'
                : 'bg-transparent text-[var(--ivory-300)] hover:text-white'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {m}
          </button>
        );
      })}
    </div>
    {leaders.length === 0 ? (
      <div className="text-[var(--ivory-300)] text-sm text-center py-12 italic opacity-60">
        No ranked players yet.
      </div>
    ) : (
      <div className="space-y-1.5">
        {leaders.map((p, i) => {
          const elo = mode === 'classic' ? p.eloClassic : p.eloTeams;
          const isMe = !!myProfileId && p._id === myProfileId;
          return (
            <div
              key={p._id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition ${
                isMe
                  ? 'bg-[var(--gradient-gold)] text-[var(--ink-900)] font-black border border-[var(--gold-400)] shadow-[var(--gold-glow)]'
                  : 'casino-panel border-[rgba(212,175,55,0.15)]'
              }`}
            >
              <span
                className={`w-5 text-right font-mono font-bold text-xs ${isMe ? 'text-[var(--ink-900)]' : 'text-[var(--gold-400)]'}`}
              >
                {i + 1}
              </span>
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.username}
                  className="w-7 h-7 rounded-full object-cover border border-[rgba(212,175,55,0.22)]"
                />
              ) : (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border border-[rgba(212,175,55,0.22)] ${isMe ? 'bg-black/20 text-[var(--ink-900)]' : 'bg-[var(--gradient-velvet)] text-[var(--gold-300)]'}`}
                >
                  {p.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className={`flex-1 font-bold truncate ${isMe ? 'text-[var(--ink-900)]' : 'text-[var(--ivory-100)]'}`}
              >
                {p.username}
              </span>
              <span
                className={`font-extrabold font-display ${isMe ? 'text-[var(--ink-900)]' : 'text-[var(--gold-300)]'}`}
              >
                ★ {elo}
              </span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
