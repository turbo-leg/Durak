import React, { useEffect, useState } from 'react';
import { BADGES } from '@durak/shared';

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
  badges: string[];
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
    <div className="casino-panel p-5 border-[rgba(212,175,55,0.22)] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="w-12 h-12 rounded-full border-2 border-[var(--gold-400)] shadow-[var(--gold-glow)]"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[var(--gradient-velvet)] flex items-center justify-center text-xl font-bold border-2 border-[var(--gold-400)] text-[var(--gold-300)] shadow-[var(--gold-glow)]">
            {username.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div
            className="font-bold text-base leading-tight font-display text-[var(--ivory-50)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {username}
          </div>
          {profile && (
            <div className="text-[var(--gold-400)] text-[10px] font-bold tracking-wide">
              ★ {elo} <span className="text-[var(--ivory-300)] font-normal opacity-70">ELO</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-black/45 border border-[rgba(212,175,55,0.15)] mb-4">
        {(['stats', 'history', 'leaderboard'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-label={t === 'leaderboard' ? 'Leaderboard' : undefined}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition border-none cursor-pointer ${
                active
                  ? 'bg-[var(--gradient-gold)] text-[var(--ink-900)] font-extrabold shadow-sm'
                  : 'bg-transparent text-[var(--ivory-300)] hover:text-white'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t === 'leaderboard' ? (
                <>
                  <span aria-hidden="true">🏆 LEADER</span>
                  <span className="sr-only">Leaderboard</span>
                </>
              ) : (
                t
              )}
            </button>
          );
        })}
      </div>

      {loading && tab !== 'leaderboard' ? (
        <div className="text-[var(--gold-400)] text-xs text-center py-4 animate-pulse font-bold tracking-widest">
          LOADING STATS…
        </div>
      ) : tab === 'stats' ? (
        stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Games Played" value={stats.gamesPlayed} />
            <StatCard label="Win Rate" value={`${winRate}%`} highlight={winRate >= 50} />
            <StatCard label="Wins" value={stats.wins} highlight />
            <StatCard label="Durak" value={stats.durakCount} dim />
            <div className="col-span-2 bg-[var(--gradient-velvet)] border border-[rgba(212,175,55,0.18)] rounded-lg p-3 flex justify-between items-center shadow-md">
              <div>
                <div
                  className="text-[var(--gold-400)] font-black text-lg font-display"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  ★ {profile?.eloClassic ?? 1000}
                </div>
                <div className="text-[var(--ivory-300)] text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-70">
                  Classic ELO
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-[var(--gold-400)] font-black text-lg font-display"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  ★ {profile?.eloTeams ?? 1000}
                </div>
                <div className="text-[var(--ivory-300)] text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-70">
                  Teams ELO
                </div>
              </div>
            </div>
            <BadgesSection earned={profile?.badges ?? []} />
          </div>
        ) : (
          <div className="text-[var(--ivory-300)] text-xs text-center py-4 italic opacity-60">
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
  <div className="bg-[var(--gradient-velvet)] border border-[rgba(212,175,55,0.15)] rounded-lg p-3 text-center">
    <div
      className={`text-xl font-black font-display ${
        highlight ? 'text-emerald-400' : dim ? 'text-red-400' : 'text-[var(--gold-300)]'
      }`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {value}
    </div>
    <div className="text-[var(--ivory-300)] text-[9px] font-bold uppercase tracking-widest mt-1 opacity-70">
      {label}
    </div>
  </div>
);

const HistoryList: React.FC<{ history: MatchRecord[]; playerId: string }> = ({
  history,
  playerId,
}) => {
  if (history.length === 0) {
    return (
      <div className="text-[var(--ivory-300)] text-xs text-center py-4 italic opacity-60">
        No match history yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {history.map((m) => {
        const won = m.winners.includes(playerId);
        const wasDurak = m.durak === playerId;
        const result = won ? 'Win' : wasDurak ? 'Durak' : 'Loss';
        const resultColor = won
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
            className="flex items-center justify-between bg-black/25 border border-[rgba(212,175,55,0.15)] rounded-lg px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className={`font-black uppercase tracking-wider text-[10px] ${resultColor}`}>
                {result}
              </span>
              <span className="text-[var(--ivory-200)] capitalize font-semibold">
                {m.mode} Mode
              </span>
            </div>
            <div className="text-[var(--ivory-300)] opacity-70 text-[10px]">{date}</div>
          </div>
        );
      })}
    </div>
  );
};

const BadgesSection: React.FC<{ earned: string[] }> = ({ earned }) => {
  const earnedBadges = BADGES.filter((b) => earned.includes(b.id));
  if (earnedBadges.length === 0) return null;
  return (
    <div className="col-span-2 mt-2">
      <div
        className="text-[var(--gold-400)] text-[9px] mb-1.5 font-bold uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Badges
      </div>
      <div className="flex flex-wrap gap-1.5">
        {earnedBadges.map((b) => (
          <span
            key={b.id}
            title={b.description}
            className="inline-flex items-center gap-1 bg-black/25 border border-[rgba(212,175,55,0.22)] rounded-full px-2.5 py-1 text-[11px] font-bold text-[var(--ivory-50)]"
          >
            <span>{b.emoji}</span>
            <span>{b.name}</span>
          </span>
        ))}
      </div>
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
    <div className="flex gap-1 p-0.5 bg-black/45 border border-[rgba(212,175,55,0.15)] rounded mb-3">
      {(['classic', 'teams'] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition border-none cursor-pointer ${
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
      <div className="text-[var(--ivory-300)] text-xs text-center py-4 italic opacity-60">
        No ranked players yet.
      </div>
    ) : (
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {leaders.map((p, i) => {
          const elo = mode === 'classic' ? p.eloClassic : p.eloTeams;
          const isMe = !!myProfileId && p._id === myProfileId;
          return (
            <div
              key={p._id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition ${
                isMe
                  ? 'bg-[var(--gradient-gold)] text-[var(--ink-900)] font-black border border-[var(--gold-400)] shadow-sm'
                  : 'bg-black/25 border border-[rgba(212,175,55,0.15)]'
              }`}
            >
              <span
                className={`w-4 text-right shrink-0 font-mono font-bold ${isMe ? 'text-[var(--ink-900)]' : 'text-[var(--gold-400)]'}`}
              >
                {i + 1}
              </span>
              <span
                className={`flex-1 font-bold truncate ${isMe ? 'text-[var(--ink-900)]' : 'text-[var(--ivory-100)]'}`}
              >
                {p.username}
              </span>
              <span
                className={`font-extrabold font-display shrink-0 ${isMe ? 'text-[var(--ink-900)]' : 'text-[var(--gold-300)]'}`}
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
