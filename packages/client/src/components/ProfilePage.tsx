import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { LoginPanel } from './LoginPanel';
import { colors, fonts, shadows } from '../theme';
import { useIsDesktop } from '../utils/useIsDesktop';

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
  premium?: { active: boolean };
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

const API = '/api';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { latestStats } = useGame();
  const isDesktop = useIsDesktop();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'leaderboard' | 'achievements' | 'history'>(
    'stats',
  );
  const [leaders, setLeaders] = useState<any[]>([]);
  const [leaderMode, setLeaderMode] = useState<'classic' | 'teams'>('classic');

  const id = user?.id ?? '';
  const byParam = user?.method === 'email' ? '?by=user' : '';

  const fetchProfile = React.useCallback(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API}/profile/${id}${byParam}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/history/${id}?limit=50${byParam ? '&by=user' : ''}`).then((r) =>
        r.ok ? r.json() : [],
      ),
    ])
      .then(([prof, hist]) => {
        setProfile(prof);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .catch(() => setHistory([]));
  }, [id, byParam]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetch(`${API}/leaderboard?mode=${leaderMode}&limit=20`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLeaders(Array.isArray(d) ? d : []))
      .catch(() => setLeaders([]));
  }, [leaderMode]);

  if (!user) {
    return <LoginPanel />;
  }

  const stats = latestStats?.stats ??
    profile?.stats ?? {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      durakCount: 0,
      winStreak: 0,
      durakFreeStreak: 0,
    };
  const eloClassic = latestStats?.eloClassic ?? profile?.eloClassic ?? 1000;
  const coins = latestStats?.coins ?? profile?.coins ?? 0;
  const winRate = stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const displayId = id ? `#GK${id.substring(0, 4).toUpperCase()}` : '#GK001';

  // ── Compute ELO History Points for SVG Graph ─────────────────────────────────
  const getGraphPoints = () => {
    if (history.length === 0) {
      // Return a nice default climbing curve for visual aesthetics
      return [
        { x: 0, y: 15 },
        { x: 2, y: 22 },
        { x: 4, y: 18 },
        { x: 6, y: 32 },
        { x: 8, y: 28 },
        { x: 10, y: 46 },
      ];
    }

    // Baseline ELO starts at 1000. Reconstruct timeline from oldest to newest
    const timeline = [...history].reverse();
    let currentElo = 1000;
    const eloPoints = [1000];

    timeline.forEach((match) => {
      const won = match.winners.includes(id);
      const isLoss = match.durak === id;
      if (won) currentElo += 16;
      else if (isLoss) currentElo -= 16;
      else currentElo += 4; // middle finish
      eloPoints.push(currentElo);
    });

    const plotCount = 11;
    const step = Math.max(1, eloPoints.length / (plotCount - 1));
    const sampledPoints = [];
    for (let i = 0; i < plotCount; i++) {
      const idx = Math.min(eloPoints.length - 1, Math.round(i * step));
      sampledPoints.push(eloPoints[idx]);
    }

    const minElo = Math.min(...sampledPoints, 900) - 50;
    const maxElo = Math.max(...sampledPoints, 1300) + 50;
    const eloRange = maxElo - minElo;

    return sampledPoints.map((elo, idx) => {
      const yVal = Math.round(((elo - minElo) / eloRange) * 50);
      return { x: idx, y: yVal };
    });
  };

  const graphPoints = getGraphPoints();

  const svgPath = graphPoints
    .map((pt, index) => {
      const px = 30 + (pt.x / 10) * 210;
      const py = 105 - (pt.y / 50) * 90;
      return `${index === 0 ? 'M' : 'L'} ${px} ${py}`;
    })
    .join(' ');

  // ── Badges List ─────────────────────────────────────────────────────────────
  const customBadges = [
    {
      id: 'games_100',
      name: '100 Games',
      description: 'Play 100 matches of Muushig',
      icon: '🏆',
      unlocked: stats.gamesPlayed >= 100,
    },
    {
      id: 'streak_10',
      name: '10 Wins Streak',
      description: 'Achieve a streak of 10 consecutive wins',
      icon: '🔥',
      unlocked: stats.winStreak >= 10,
    },
    {
      id: 'ulzii_champion',
      name: 'Ölzii Champion',
      description: 'Climb above 1200 ELO to claim the title',
      icon: '👑',
      unlocked: eloClassic >= 1200,
    },
  ];

  // ── Render Stats Tab ─────────────────────────────────────────────────────────
  const renderStatsTab = () => (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <div
          className="rounded-xl border p-4 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(20,5,5,0.7), rgba(10,2,2,0.85))',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
          }}
        >
          <div
            className="text-2xl font-black font-display tracking-wider"
            style={{
              backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {stats.wins}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[rgba(216,200,156,0.65)] mt-1">
            Total Wins
          </div>
        </div>

        <div
          className="rounded-xl border p-4 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(20,5,5,0.7), rgba(10,2,2,0.85))',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
          }}
        >
          <div
            className="text-2xl font-black font-display tracking-wider"
            style={{
              backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {winRate}%
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[rgba(216,200,156,0.65)] mt-1">
            Win Rate
          </div>
        </div>

        <div
          className="rounded-xl border p-4 text-center flex flex-col items-center justify-center"
          style={{
            background: 'linear-gradient(180deg, rgba(20,5,5,0.7), rgba(10,2,2,0.85))',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
          }}
        >
          <div className="flex items-center gap-1.5 justify-center">
            <img
              src="/assets/coin.png"
              alt="Coins"
              className="w-5.5 h-5.5 object-contain"
              style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
            />
            <span
              className="text-2xl font-black font-display tracking-wider"
              style={{
                backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {coins.toLocaleString()}
            </span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[rgba(216,200,156,0.65)] mt-1">
            Coins
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          className="rounded-2xl border p-4 flex flex-col"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.4), rgba(20,5,5,0.6))',
            borderColor: 'rgba(212,175,55,0.18)',
            boxShadow: shadows.engrave,
          }}
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="font-display font-extrabold uppercase border-b border-[rgba(212,175,55,0.22)]"
                style={{ color: colors.gold[300], letterSpacing: 1 }}
              >
                <th className="pb-3 font-semibold">Game Type</th>
                <th className="pb-3 text-center font-semibold">Played</th>
                <th className="pb-3 text-center font-semibold">Wins</th>
                <th className="pb-3 text-center font-semibold">Losses</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-[rgba(216,200,156,0.85)]">
              <tr className="border-b border-[rgba(212,175,55,0.08)]">
                <td className="py-3.5">Classic 15</td>
                <td className="py-3.5 text-center">{stats.gamesPlayed}</td>
                <td className="py-3.5 text-center">{stats.wins}</td>
                <td className="py-3.5 text-center">{stats.losses + stats.durakCount}</td>
              </tr>
              <tr className="border-b border-[rgba(212,175,55,0.08)]">
                <td className="py-3.5">Tourney 7</td>
                <td className="py-3.5 text-center">0</td>
                <td className="py-3.5 text-center">0</td>
                <td className="py-3.5 text-center">0</td>
              </tr>
              <tr>
                <td className="py-3.5">Private</td>
                <td className="py-3.5 text-center">0</td>
                <td className="py-3.5 text-center">0</td>
                <td className="py-3.5 text-center">0</td>
              </tr>
              <tr
                className="border-t border-[rgba(212,175,55,0.22)] font-display font-extrabold"
                style={{ color: colors.gold[300] }}
              >
                <td className="pt-3 font-semibold">Avg Score</td>
                <td className="pt-3 text-center font-semibold">Game</td>
                <td className="pt-3 text-center font-semibold">Wins</td>
                <td className="pt-3 text-center font-semibold">Losses</td>
              </tr>
              <tr className="text-[rgba(216,200,156,0.85)]">
                <td className="py-3">Tourney 7</td>
                <td className="py-3 text-center">0</td>
                <td className="py-3 text-center">0</td>
                <td className="py-3 text-center">0</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          className="rounded-2xl border p-4 flex flex-col"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.4), rgba(20,5,5,0.6))',
            borderColor: 'rgba(212,175,55,0.18)',
            boxShadow: shadows.engrave,
          }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wider mb-3 select-none"
            style={{ color: colors.gold[400], fontFamily: fonts.display }}
          >
            Skill Rating
          </div>
          <div className="relative w-full aspect-[26/12] flex items-center justify-center">
            <svg viewBox="0 0 260 120" className="w-full h-full overflow-visible">
              {[0, 10, 20, 30, 40, 50].map((y) => {
                const py = 105 - (y / 50) * 90;
                return (
                  <line
                    key={y}
                    x1="30"
                    y1={py}
                    x2="240"
                    y2={py}
                    stroke="rgba(212,175,55,0.1)"
                    strokeWidth="1"
                  />
                );
              })}
              {[0, 2, 4, 6, 8, 10].map((x) => {
                const px = 30 + (x / 10) * 210;
                return (
                  <line
                    key={x}
                    x1={px}
                    y1="15"
                    x2={px}
                    y2="105"
                    stroke="rgba(212,175,55,0.1)"
                    strokeWidth="1"
                  />
                );
              })}

              {[0, 10, 20, 30, 40, 50].map((y) => {
                const py = 105 - (y / 50) * 90;
                return (
                  <text
                    key={y}
                    x="20"
                    y={py + 3}
                    textAnchor="end"
                    fill="rgba(216,200,156,0.4)"
                    fontSize="7.5"
                    fontWeight="bold"
                  >
                    {y}
                  </text>
                );
              })}

              {[0, 2, 4, 6, 8, 10].map((x) => {
                const px = 30 + (x / 10) * 210;
                return (
                  <text
                    key={x}
                    x={px}
                    y="116"
                    textAnchor="middle"
                    fill="rgba(216,200,156,0.4)"
                    fontSize="7.5"
                    fontWeight="bold"
                  >
                    {x}
                  </text>
                );
              })}

              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af37" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
                </linearGradient>
              </defs>
              {graphPoints.length > 0 && (
                <path
                  d={`${svgPath} L ${30 + (graphPoints[graphPoints.length - 1].x / 10) * 210} 105 L 30 105 Z`}
                  fill="url(#chartGradient)"
                />
              )}

              <path
                d={svgPath}
                fill="none"
                stroke="#d4af37"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {graphPoints.map((pt, idx) => {
                const px = 30 + (pt.x / 10) * 210;
                const py = 105 - (pt.y / 50) * 90;
                const isLast = idx === graphPoints.length - 1;
                return (
                  <g key={idx} className="cursor-pointer">
                    <circle
                      cx={px}
                      cy={py}
                      r={isLast ? 4.5 : 3}
                      fill={isLast ? '#fce28a' : '#d4af37'}
                      stroke="#2a0a0a"
                      strokeWidth="1.5"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Render Leaderboard Tab ───────────────────────────────────────────────────
  const renderLeaderboardTab = () => (
    <div className="flex flex-col gap-4 animate-fade-in text-white">
      <div className="flex gap-1.5 p-1 bg-black/45 border border-[rgba(212,175,55,0.15)] rounded-xl max-w-xs self-start w-full">
        {(['classic', 'teams'] as const).map((m) => {
          const active = leaderMode === m;
          return (
            <button
              key={m}
              onClick={() => setLeaderMode(m)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none cursor-pointer ${
                active
                  ? 'bg-[var(--gradient-gold)] text-[var(--ink-900)] font-extrabold shadow-sm'
                  : 'bg-transparent text-[var(--ivory-300)] hover:text-white'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {m === 'classic' ? 'Classic' : 'Teams'}
            </button>
          );
        })}
      </div>

      {leaders.length === 0 ? (
        <div className="text-[rgba(216,200,156,0.45)] text-sm text-center py-12 italic">
          No ranked players yet
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
          {leaders.map((p, i) => {
            const elo = leaderMode === 'classic' ? p.eloClassic : p.eloTeams;
            const isMe = p._id === profile?._id;
            return (
              <div
                key={p._id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition"
                style={{
                  background: isMe
                    ? 'linear-gradient(180deg, rgba(212,175,55,0.12), rgba(42,10,10,0.5))'
                    : 'linear-gradient(180deg, rgba(20,5,5,0.7), rgba(10,2,2,0.85))',
                  borderColor: isMe ? '#d4af37' : 'rgba(212,175,55,0.15)',
                  boxShadow: isMe ? shadows.goldGlow : shadows.engrave,
                }}
              >
                <span
                  className="w-6 text-right font-mono font-bold text-xs"
                  style={{ color: isMe ? '#fce28a' : '#d4af37' }}
                >
                  {i + 1}
                </span>
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt={p.username}
                    className="w-7.5 h-7.5 rounded-full object-cover border border-[#d4af37]"
                  />
                ) : (
                  <div
                    className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-xs font-bold border"
                    style={{
                      borderColor: '#d4af37',
                      background: 'linear-gradient(180deg, #2a0a0a, #5b1818)',
                      color: colors.gold[300],
                    }}
                  >
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 font-bold truncate text-white">{p.username}</span>
                <span className="font-extrabold font-display" style={{ color: colors.gold[300] }}>
                  ★ {elo}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Render Achievements Tab ──────────────────────────────────────────────────
  const renderAchievementsTab = () => (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {customBadges.map((badge) => (
          <div
            key={badge.id}
            className="rounded-2xl border p-5 flex flex-col items-center text-center transition duration-200"
            style={{
              background: badge.unlocked
                ? 'linear-gradient(180deg, rgba(212,175,55,0.08), rgba(42,10,10,0.45))'
                : 'linear-gradient(180deg, rgba(20,5,5,0.4), rgba(10,2,2,0.6))',
              borderColor: badge.unlocked ? 'rgba(212,175,55,0.4)' : 'rgba(212,175,55,0.12)',
              boxShadow: badge.unlocked ? '0 8px 24px rgba(212,175,55,0.08)' : 'none',
              opacity: badge.unlocked ? 1 : 0.45,
            }}
          >
            <span
              className="text-4xl mb-3.5 block select-none"
              style={{
                filter: badge.unlocked ? 'drop-shadow(0 4px 8px rgba(212,175,55,0.4))' : 'none',
              }}
            >
              {badge.icon}
            </span>
            <div
              className="font-bold text-sm font-display mb-1.5"
              style={{ color: badge.unlocked ? colors.gold[300] : colors.ivory[300] }}
            >
              {badge.name}
            </div>
            <p className="text-xs text-[rgba(216,200,156,0.7)] leading-relaxed m-0">
              {badge.description}
            </p>
            {badge.unlocked && (
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 mt-4 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/25">
                Completed
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Render Game History Tab ─────────────────────────────────────────────────
  const renderHistoryTab = () => (
    <div className="flex flex-col gap-3 animate-fade-in">
      {history.length === 0 ? (
        <div className="text-[rgba(216,200,156,0.45)] text-sm text-center py-12 italic">
          No match history yet
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {history.map((match) => {
            const won = match.winners.includes(id);
            const isDurak = match.durak === id;
            const result = won ? 'Win' : isDurak ? 'Durak' : 'Loss';
            const color = won
              ? 'text-emerald-400'
              : isDurak
                ? 'text-red-400'
                : 'text-[rgba(216,200,156,0.6)]';
            const dateStr = new Date(match.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <div
                key={match._id}
                className="flex items-center justify-between border rounded-xl px-5 py-4 transition"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,5,5,0.7), rgba(10,2,2,0.85))',
                  borderColor: 'rgba(212,175,55,0.15)',
                  boxShadow: shadows.engrave,
                }}
              >
                <div className="flex items-center gap-4">
                  <span className={`font-extrabold uppercase tracking-widest text-xs ${color}`}>
                    {result}
                  </span>
                  <span className="text-white font-bold capitalize text-sm">{match.mode} Mode</span>
                </div>
                <span className="text-[rgba(216,200,156,0.5)] text-xs font-semibold">
                  {dateStr}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── DESKTOP VIEW ────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div className="min-h-screen bg-transparent text-white flex flex-col">
        {/* Content area - Global header handled in App.tsx */}
        <main className="flex-1 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 p-8 relative z-10">
          {/* Left profile column */}
          <div className="flex flex-col gap-6">
            <div
              className="rounded-2xl border p-6 flex flex-col items-center text-center relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(42,10,10,0.85) 0%, rgba(20,5,5,0.95) 100%)',
                borderColor: 'rgba(212,175,55,0.3)',
                boxShadow: shadows.mid,
              }}
            >
              <div
                className="w-24 h-24 rounded-full border-3 overflow-hidden shadow-xl mb-4 relative"
                style={{
                  borderColor: '#d4af37',
                  background: 'linear-gradient(180deg, #2a0a0a, #5b1818)',
                }}
              >
                <img
                  src="/assets/mongolian_boy.png"
                  alt={user.username}
                  className="w-full h-full object-cover scale-105"
                />
              </div>
              <h2
                className="text-xl font-bold font-display text-white tracking-wider truncate max-w-full"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
              >
                {user.username}
              </h2>
              <div className="text-[10px] font-bold tracking-widest text-[#d4af37] font-display mt-0.5 uppercase opacity-90">
                {displayId}
              </div>
            </div>

            <div
              className="rounded-2xl border aspect-[4/3] relative overflow-hidden group select-none"
              style={{
                borderColor: 'rgba(212,175,55,0.22)',
                boxShadow: shadows.mid,
              }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: 'url("/assets/home_illustration.png")' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src="/assets/logo.png"
                  alt="Muushig logo"
                  className="w-16 h-16 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                />
              </div>
            </div>
          </div>

          {/* Right tabs and details column */}
          <div className="flex flex-col gap-6">
            {/* Tabs */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-black/45 border border-[rgba(212,175,55,0.15)] shadow-inner">
              {(['stats', 'leaderboard', 'achievements', 'history'] as const).map((tabKey) => {
                const active = activeTab === tabKey;
                return (
                  <button
                    key={tabKey}
                    onClick={() => setActiveTab(tabKey)}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] lg:text-xs font-extrabold uppercase tracking-widest transition duration-150 border-none cursor-pointer ${
                      active
                        ? 'bg-[var(--gradient-gold)] text-[var(--ink-900)] shadow-md font-black'
                        : 'bg-transparent text-[var(--ivory-300)] hover:text-white'
                    }`}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {tabKey === 'stats'
                      ? 'Stats'
                      : tabKey === 'leaderboard'
                        ? 'Leaderboard'
                        : tabKey === 'achievements'
                          ? 'Achievements'
                          : 'History'}
                  </button>
                );
              })}
            </div>

            {/* Tab content area */}
            <div className="flex-1">
              {activeTab === 'stats' && renderStatsTab()}
              {activeTab === 'leaderboard' && renderLeaderboardTab()}
              {activeTab === 'achievements' && renderAchievementsTab()}
              {activeTab === 'history' && renderHistoryTab()}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── MOBILE VIEW ─────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-transparent text-white pb-28 select-none"
      style={{
        paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex items-center gap-2.5 px-6 mb-6">
        <img src="/assets/logo.png" alt="Muushig Logo" className="w-8 h-8 object-contain" />
        <span
          className="text-xl font-black font-display uppercase tracking-wider"
          style={{
            backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Muushig
        </span>
      </div>

      <div className="px-4 flex flex-col gap-5">
        <div
          className="rounded-2xl border p-5 flex items-center gap-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.85), rgba(20,5,5,0.95))',
            borderColor: 'rgba(212,175,55,0.38)',
            boxShadow: shadows.mid,
          }}
        >
          <div
            className="w-16 h-16 rounded-full border-2 overflow-hidden shadow-md relative"
            style={{
              borderColor: '#d4af37',
              background: 'linear-gradient(180deg, #2a0a0a, #5b1818)',
            }}
          >
            <img
              src="/assets/mongolian_boy.png"
              alt={user.username}
              className="w-full h-full object-cover scale-105"
            />
          </div>
          <div>
            <h2
              className="text-lg font-black font-display text-white tracking-wide leading-tight"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
            >
              {user.username}
            </h2>
            <div className="text-[10px] font-bold tracking-widest text-[#d4af37] font-display mt-0.5 uppercase opacity-90">
              {displayId}
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.45), rgba(20,5,5,0.65))',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
          }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wider font-display"
            style={{ color: colors.gold[400] }}
          >
            {user.username} Profile
          </div>

          <div className="flex flex-col gap-3 font-semibold text-sm">
            <div className="flex justify-between border-b border-[rgba(212,175,55,0.1)] pb-2.5">
              <span className="text-[rgba(216,200,156,0.6)]">ID</span>
              <span className="text-white font-bold">{displayId}</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(212,175,55,0.1)] pb-2.5">
              <span className="text-[rgba(216,200,156,0.6)]">Total Games</span>
              <span className="text-white font-bold">{stats.gamesPlayed}</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(212,175,55,0.1)] pb-2.5">
              <span className="text-[rgba(216,200,156,0.6)]">Total Wins</span>
              <span className="text-white font-bold">{stats.wins}</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(212,175,55,0.1)] pb-2.5">
              <span className="text-[rgba(216,200,156,0.6)]">Win Rate</span>
              <span className="text-white font-bold">{winRate}%</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(212,175,55,0.1)] pb-2.5">
              <span className="text-[rgba(216,200,156,0.6)]">Highest Score (Classic)</span>
              <span className="text-white font-bold">{stats.winStreak}</span>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <span className="text-[rgba(216,200,156,0.6)] text-xs">Achievement Badges</span>
              <div className="flex gap-2.5 mt-1 overflow-x-auto pb-1">
                {customBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-1.5 border rounded-full px-3.5 py-1.5 text-xs shrink-0"
                    style={{
                      background: badge.unlocked
                        ? 'linear-gradient(180deg, rgba(212,175,55,0.12), rgba(42,10,10,0.35))'
                        : 'rgba(0,0,0,0.25)',
                      borderColor: badge.unlocked
                        ? 'rgba(212,175,55,0.45)'
                        : 'rgba(212,175,55,0.12)',
                      opacity: badge.unlocked ? 1 : 0.35,
                    }}
                    title={badge.description}
                  >
                    <span>{badge.icon}</span>
                    <span className="font-bold text-white text-[11px]">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Players Leaderboard on Mobile */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.45), rgba(20,5,5,0.65))',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold uppercase tracking-wider font-display"
              style={{ color: colors.gold[400] }}
            >
              Leaderboard
            </span>
            <div className="flex gap-1.5 p-0.5 bg-black/35 rounded-lg border border-[rgba(212,175,55,0.12)]">
              {(['classic', 'teams'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setLeaderMode(m)}
                  className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border-none cursor-pointer"
                  style={{
                    background: leaderMode === m ? colors.gold[500] : 'transparent',
                    color: leaderMode === m ? colors.ink[900] : 'rgba(216,200,156,0.6)',
                  }}
                >
                  {m === 'classic' ? 'Classic' : 'Teams'}
                </button>
              ))}
            </div>
          </div>

          {leaders.length === 0 ? (
            <div className="text-[rgba(216,200,156,0.4)] text-xs italic py-6 text-center">
              No rankings available
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {leaders.slice(0, 5).map((p, i) => {
                const elo = leaderMode === 'classic' ? p.eloClassic : p.eloTeams;
                const isMe = p._id === profile?._id;
                return (
                  <div
                    key={p._id}
                    className="flex justify-between items-center text-sm font-semibold border-b border-[rgba(212,175,55,0.04)] pb-2 last:border-b-0 last:pb-0"
                    style={{ color: isMe ? colors.gold[300] : 'white' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[rgba(216,200,156,0.5)]">
                        #{i + 1}
                      </span>
                      <span className="truncate max-w-[120px]">{p.username}</span>
                    </div>
                    <span className="text-xs text-[#d4af37]">★ {elo}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Game History */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{
            background: 'linear-gradient(180deg, rgba(42,10,10,0.45), rgba(20,5,5,0.65))',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: shadows.engrave,
          }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wider font-display"
            style={{ color: colors.gold[400] }}
          >
            Recent Game History
          </div>

          {history.length === 0 ? (
            <div className="text-[rgba(216,200,156,0.4)] text-xs italic py-6 text-center">
              No recent games
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {history.slice(0, 5).map((match) => {
                const won = match.winners.includes(id);
                const isDurak = match.durak === id;
                const result = won ? 'Win' : isDurak ? 'Loss' : 'Loss';
                const color = won ? 'text-emerald-400' : 'text-red-400';
                const dateStr = new Date(match.date).toLocaleDateString(undefined, {
                  month: 'numeric',
                  day: 'numeric',
                  year: '2-digit',
                });
                return (
                  <div
                    key={match._id}
                    className="flex justify-between items-center text-sm font-semibold border-b border-[rgba(212,175,55,0.06)] pb-2.5 last:border-b-0 last:pb-0"
                  >
                    <span className="capitalize">
                      {match.mode} 15 - <span className={color}>{result}</span>
                    </span>
                    <span className="text-[rgba(216,200,156,0.4)] text-xs">{dateStr}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
