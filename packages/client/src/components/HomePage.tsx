import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { LoginPanel } from './LoginPanel';
import type { RoomAvailable } from 'colyseus.js';
import { colors, gradients, shadows, radii, fonts } from '../theme';
import { GoldButton, Sheet, Pill, SectionLabel, Divider, TextInput, Select, Diamond } from './ui';

interface HomePageProps {
  discordId?: string;
  userId?: string;
  username?: string;
  avatarUrl?: string;
  error?: string | null;
}

type SheetKey = 'ranked' | 'custom' | 'solo' | null;

interface RankedOptions {
  mode: 'classic' | 'teams';
  maxPlayers: number;
  handSize: number;
}
type HomeState = 'home' | 'searching';

// ── helpers ───────────────────────────────────────────────────────────────────

function getAvailablePlayers(mode: string) {
  return mode === 'teams' ? [4, 6] : [2, 3, 4, 5, 6];
}
function getAvailableHandSizes(mode: string, players: number) {
  if (mode === 'teams') return players === 4 ? [7] : [5];
  return players <= 4 ? [5, 7] : [5];
}

// ── Floating intro cards ──────────────────────────────────────────────────────

function FloatingCard({
  suit,
  rank,
  delay,
  x,
  rotate,
  scale,
}: {
  suit: string;
  rank: string;
  delay: number;
  x: number;
  rotate: number;
  scale: number;
}) {
  const isRed = suit === '♥' || suit === '♦';
  return (
    <motion.div
      initial={{ y: -180, opacity: 0, rotate: rotate - 25 }}
      animate={{ y: 0, opacity: 1, rotate }}
      transition={{ delay, duration: 0.9, type: 'spring', stiffness: 70, damping: 13 }}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: '5%',
        scale,
        zIndex: 1,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.55))',
      }}
    >
      <div
        style={{
          width: 64,
          height: 92,
          background: gradients.card,
          borderRadius: 8,
          border: `1px solid ${colors.gold[700]}`,
          padding: '6px 7px',
          color: isRed ? '#a01818' : '#1b150a',
          fontFamily: fonts.display,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5), 0 6px 16px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>
          <div>{rank}</div>
          <div style={{ fontSize: 14, marginTop: 1 }}>{suit}</div>
        </div>
        <div style={{ fontSize: 22, textAlign: 'center', opacity: 0.22, fontWeight: 900 }}>
          {suit}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1,
            transform: 'rotate(180deg)',
            alignSelf: 'flex-end',
          }}
        >
          <div>{rank}</div>
          <div style={{ fontSize: 14, marginTop: 1 }}>{suit}</div>
        </div>
      </div>
    </motion.div>
  );
}

const FLOATING_CARDS = [
  { suit: '♠', rank: 'A', delay: 0.05, x: 4, rotate: -22, scale: 0.85 },
  { suit: '♥', rank: 'K', delay: 0.15, x: 14, rotate: -10, scale: 0.95 },
  { suit: '♦', rank: 'Q', delay: 0.1, x: 24, rotate: 4, scale: 0.9 },
  { suit: '♣', rank: 'J', delay: 0.2, x: 70, rotate: -5, scale: 0.9 },
  { suit: '♥', rank: '7', delay: 0.12, x: 80, rotate: 12, scale: 0.95 },
  { suit: '♠', rank: 'A', delay: 0.07, x: 89, rotate: 24, scale: 0.85 },
];

// ── Searching overlay ─────────────────────────────────────────────────────────

function SearchingOverlay({ onCancel, label }: { onCancel: () => void; label: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        zIndex: 10,
      }}
    >
      {/* Rotating roulette-style ring */}
      <div style={{ position: 'relative', width: 168, height: 168 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(${colors.gold[500]} 0deg, transparent 60deg, ${colors.gold[500]} 120deg, transparent 180deg, ${colors.gold[500]} 240deg, transparent 300deg)`,
            mask: 'radial-gradient(circle, transparent 60%, black 62%, black 100%)',
            WebkitMask: 'radial-gradient(circle, transparent 60%, black 62%, black 100%)',
            filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.5))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 16,
            borderRadius: '50%',
            background: gradients.velvet,
            border: `2px solid ${colors.gold[600]}`,
            boxShadow: `inset 0 0 24px rgba(0,0,0,0.6), ${shadows.goldGlow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
          }}
        >
          ♠
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 22,
            color: colors.gold[300],
            letterSpacing: 4,
            textTransform: 'uppercase',
            textShadow: '0 2px 6px rgba(0,0,0,0.7)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14,
            color: colors.ivory[300],
            marginTop: 8,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 1,
          }}
        >
          {fmt(elapsed)}
        </div>
      </div>

      <GoldButton variant="burgundy" size="md" onClick={onCancel}>
        Cancel
      </GoldButton>
    </motion.div>
  );
}

// ── Ranked config sheet ───────────────────────────────────────────────────────

function RankedConfigSheet({ onFindMatch }: { onFindMatch: (opts: RankedOptions) => void }) {
  const [mode, setMode] = useState<'classic' | 'teams'>('classic');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [handSize, setHandSize] = useState(6);

  const playerOptions = getAvailablePlayers(mode);
  const handSizeOptions = getAvailableHandSizes(mode, maxPlayers);
  const effectiveHandSize = handSizeOptions.includes(handSize) ? handSize : handSizeOptions[0]!;

  const handleModeChange = (m: 'classic' | 'teams') => {
    setMode(m);
    const opts = getAvailablePlayers(m);
    const np = opts.includes(maxPlayers) ? maxPlayers : opts[0]!;
    if (np !== maxPlayers) setMaxPlayers(np);
    const hs = getAvailableHandSizes(m, np);
    if (!hs.includes(handSize)) setHandSize(hs[0]!);
  };

  const handlePlayerChange = (n: number) => {
    setMaxPlayers(n);
    const hs = getAvailableHandSizes(mode, n);
    if (!hs.includes(handSize)) setHandSize(hs[0]!);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <SectionLabel>Game Mode</SectionLabel>
        <div style={{ display: 'flex', gap: 12 }}>
          {(['classic', 'teams'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              style={{
                flex: 1,
                padding: '16px 12px',
                borderRadius: radii.md,
                cursor: 'pointer',
                background: mode === m ? gradients.gold : 'rgba(255,255,255,0.03)',
                color: mode === m ? colors.ink[900] : colors.ivory[200],
                border: `1.5px solid ${
                  mode === m ? 'rgba(212,175,55,0.85)' : 'rgba(212,175,55,0.18)'
                }`,
                fontFamily: fonts.body,
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: 0.6,
                textShadow:
                  mode === m ? '0 1px 0 rgba(255,255,255,0.3)' : '0 1px 2px rgba(0,0,0,0.6)',
                boxShadow: mode === m ? `${shadows.engrave}, ${shadows.goldGlow}` : shadows.engrave,
                transition: 'all 0.18s',
              }}
            >
              {m === 'classic' ? '♠  CLASSIC' : '⚔  TEAMS'}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  marginTop: 5,
                  opacity: 0.75,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {m === 'classic' ? 'Free for all' : '3v3 / 2v2'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Players at the Table</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {playerOptions.map((n) => (
            <Pill key={n} active={maxPlayers === n} onClick={() => handlePlayerChange(n)}>
              {n}
            </Pill>
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            color: colors.ivory[300],
            marginTop: 8,
            opacity: 0.7,
            fontStyle: 'italic',
          }}
        >
          Game begins automatically when {maxPlayers} seats are filled.
        </div>
      </div>

      {handSizeOptions.length > 1 && (
        <div>
          <SectionLabel>Cards in Hand</SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {handSizeOptions.map((s) => (
              <button
                key={s}
                onClick={() => setHandSize(s)}
                style={{
                  flex: 1,
                  padding: '14px 8px',
                  borderRadius: radii.md,
                  cursor: 'pointer',
                  background: effectiveHandSize === s ? gradients.gold : 'rgba(255,255,255,0.03)',
                  color: effectiveHandSize === s ? colors.ink[900] : colors.ivory[200],
                  border: `1.5px solid ${
                    effectiveHandSize === s ? 'rgba(212,175,55,0.85)' : 'rgba(212,175,55,0.18)'
                  }`,
                  fontFamily: fonts.display,
                  fontWeight: 700,
                  fontSize: 22,
                  boxShadow:
                    effectiveHandSize === s
                      ? `${shadows.engrave}, ${shadows.goldGlow}`
                      : shadows.engrave,
                  transition: 'all 0.18s',
                }}
              >
                {s}
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 10,
                    fontWeight: 600,
                    marginTop: 2,
                    opacity: 0.7,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                  }}
                >
                  cards
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Divider label="Stake your reputation" />

      <GoldButton
        size="lg"
        block
        onClick={() => onFindMatch({ mode, maxPlayers, handSize: effectiveHandSize })}
      >
        ♛ Find a Match
      </GoldButton>
    </div>
  );
}

// ── Single Player sheet ───────────────────────────────────────────────────────

const DIFFICULTIES = [
  {
    key: 'easy',
    label: 'Apprentice',
    icon: 'badge_apprentice.png',
    desc: 'Plays loosely, makes mistakes.',
    accent: '#3f8a4a',
  },
  {
    key: 'medium',
    label: 'Gentleman',
    icon: 'badge_gentleman.png',
    desc: 'Plays smart, occasional blunders.',
    accent: colors.gold[500],
  },
  {
    key: 'hard',
    label: 'High Roller',
    icon: 'badge_high_roller.png',
    desc: 'Ruthless. Calculates every card.',
    accent: '#a01818',
  },
] as const;

function SinglePlayerSheet() {
  const { createGame } = useGame();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePick = async (difficulty: string) => {
    setLoading(difficulty);
    await createGame({
      maxPlayers: 2,
      isPrivate: true,
      mode: 'classic',
      teamSelection: 'random',
      handSize: 6,
      botDifficulty: difficulty,
    });
    setLoading(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Choose your opponent</SectionLabel>
      {DIFFICULTIES.map((d) => (
        <button
          key={d.key}
          onClick={() => handlePick(d.key)}
          disabled={loading !== null}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 18px',
            borderRadius: radii.md,
            cursor: loading ? 'default' : 'pointer',
            background: gradients.panel,
            border: `1.5px solid ${d.accent}88`,
            color: colors.ivory[100],
            textAlign: 'left',
            transition: 'all 0.15s',
            boxShadow: `${shadows.low}, ${shadows.engrave}, 0 0 0 1px ${d.accent}33 inset`,
            opacity: loading && loading !== d.key ? 0.45 : 1,
          }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 10px rgba(0,0,0,0.6), 0 0 12px ${d.accent}44`,
              border: `1.5px solid ${d.accent}`,
              background: 'rgba(0,0,0,0.3)',
              flexShrink: 0,
            }}
          >
            {loading === d.key ? (
              <span style={{ fontSize: 24 }}>⏳</span>
            ) : (
              <img
                src={`/assets/badges/${d.icon}`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: 1,
                color: colors.gold[300],
              }}
            >
              {d.label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.ivory[300],
                marginTop: 4,
                opacity: 0.85,
              }}
            >
              {d.desc}
            </div>
          </div>
          <span style={{ color: d.accent, fontSize: 22 }}>›</span>
        </button>
      ))}
    </div>
  );
}

// ── Custom Lobby sheet ────────────────────────────────────────────────────────

function CustomLobbySheet({ discordId, userId }: { discordId?: string; userId?: string }) {
  const { createGame, joinGame, spectateGame, findPublicGames } = useGame();
  const [tab, setTab] = useState<'create' | 'join' | 'browse'>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState('classic');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [handSize, setHandSize] = useState(5);
  const [teamSelection, setTeamSelection] = useState<'random' | 'manual'>('random');

  const fetchRooms = useCallback(async () => {
    try {
      setRooms(await findPublicGames());
    } catch {
      /* ignore */
    }
  }, [findPublicGames]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'browse') void fetchRooms();
  }, [tab, fetchRooms]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <LoginPanel />

      {/* Tab strip — gold underline */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 4,
          borderRadius: radii.md,
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(212,175,55,0.15)',
          boxShadow: shadows.engrave,
        }}
      >
        {(['create', 'join', 'browse'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: radii.sm,
                border: 'none',
                cursor: 'pointer',
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                background: active ? gradients.gold : 'transparent',
                color: active ? colors.ink[900] : colors.ivory[300],
                textShadow: active ? '0 1px 0 rgba(255,255,255,0.3)' : undefined,
                boxShadow: active ? shadows.engrave : 'none',
                transition: 'all 0.18s',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <SectionLabel>Mode</SectionLabel>
            <Select
              value={mode}
              onChange={(e) => {
                const m = e.target.value;
                setMode(m);
                const vp = getAvailablePlayers(m);
                const np = vp.includes(maxPlayers) ? maxPlayers : vp[0]!;
                setMaxPlayers(np);
                const vh = getAvailableHandSizes(m, np);
                if (!vh.includes(handSize)) setHandSize(vh[0]!);
              }}
            >
              <option value="classic">Classic (Free for All)</option>
              <option value="teams">Teams (3v3 / 2v2)</option>
            </Select>
          </div>
          <div>
            <SectionLabel>Players</SectionLabel>
            <Select
              value={maxPlayers}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                setMaxPlayers(n);
                const vh = getAvailableHandSizes(mode, n);
                if (!vh.includes(handSize)) setHandSize(vh[0]!);
              }}
            >
              {getAvailablePlayers(mode).map((n) => (
                <option key={n} value={n}>
                  {n} Players
                </option>
              ))}
            </Select>
          </div>
          <div>
            <SectionLabel>Hand Size</SectionLabel>
            <Select
              value={handSize}
              onChange={(e) => setHandSize(parseInt(e.target.value))}
              disabled={getAvailableHandSizes(mode, maxPlayers).length <= 1}
            >
              {getAvailableHandSizes(mode, maxPlayers).map((s) => (
                <option key={s} value={s}>
                  {s} cards
                </option>
              ))}
            </Select>
          </div>
          {mode === 'teams' && (
            <div>
              <SectionLabel>Team Assignment</SectionLabel>
              <Select
                value={teamSelection}
                onChange={(e) => setTeamSelection(e.target.value as 'random' | 'manual')}
              >
                <option value="random">Random Teams</option>
                <option value="manual">Manual Selection</option>
              </Select>
            </div>
          )}
          <GoldButton
            size="lg"
            block
            loading={isLoading}
            onClick={async () => {
              setIsLoading(true);
              await createGame({ maxPlayers, isPrivate: true, mode, teamSelection, handSize });
              setIsLoading(false);
            }}
          >
            ＋ Open Private Table
          </GoldButton>
        </div>
      )}

      {tab === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <SectionLabel>Invitation Code</SectionLabel>
            <TextInput
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              style={{
                letterSpacing: 6,
                fontSize: 22,
                fontWeight: 900,
                fontFamily: fonts.display,
                textAlign: 'center',
                color: colors.gold[300],
              }}
            />
          </div>
          <GoldButton
            size="lg"
            block
            loading={isLoading}
            disabled={!joinCode.trim()}
            onClick={async () => {
              if (!joinCode.trim()) return;
              setIsLoading(true);
              await joinGame(joinCode.trim(), discordId, userId);
              setIsLoading(false);
            }}
          >
            ✦ Take a Seat
          </GoldButton>
        </div>
      )}

      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={fetchRooms}
              style={{
                background: 'none',
                border: 'none',
                color: colors.gold[400],
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              ↻ Refresh
            </button>
          </div>
          {rooms.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: colors.ivory[300],
                fontSize: 13,
                opacity: 0.7,
                fontStyle: 'italic',
              }}
            >
              The lounge is quiet…
              <br />
              Open a table to get things started.
            </div>
          ) : (
            rooms.map((r) => {
              const meta = r.metadata as Record<string, unknown> | null;
              const pc = (meta?.playerCount as number) ?? r.clients;
              const mx = (meta?.maxPlayers as number) ?? r.maxClients;
              const phase = (meta?.phase as string) ?? 'waiting';
              const full = pc >= mx;
              return (
                <div
                  key={r.roomId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: radii.md,
                    background: gradients.panel,
                    border: '1px solid rgba(212,175,55,0.2)',
                    boxShadow: shadows.engrave,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: fonts.display,
                        fontWeight: 700,
                        fontSize: 14,
                        color: colors.gold[300],
                        letterSpacing: 1.5,
                      }}
                    >
                      Table {r.roomId.slice(0, 6)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.ivory[300],
                        marginTop: 3,
                        opacity: 0.75,
                        letterSpacing: 0.3,
                      }}
                    >
                      {pc}/{mx} seated · {meta?.mode === 'teams' ? 'Teams' : 'Classic'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <GoldButton
                      size="sm"
                      variant={full ? 'ghost' : 'gold'}
                      disabled={isLoading || full}
                      onClick={() => joinGame(r.roomId, discordId, userId)}
                    >
                      Join
                    </GoldButton>
                    <GoldButton
                      size="sm"
                      variant="burgundy"
                      disabled={phase !== 'playing'}
                      onClick={() => spectateGame(r.roomId)}
                    >
                      Watch
                    </GoldButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Mode Button (large, on home screen) ───────────────────────────────────────

const ModeCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  accent: string;
  delay: number;
  onClick: () => void;
}> = ({ icon, title, subtitle, accent, delay, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', stiffness: 160, damping: 20 }}
    whileHover={{ y: -4 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    style={{
      background: gradients.panel,
      border: `1.5px solid ${accent}`,
      borderRadius: radii.md,
      padding: '16px 18px',
      color: colors.ivory[100],
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flex: '1 1 180px',
      minWidth: 175,
      boxShadow: `${shadows.mid}, ${shadows.engrave}`,
      textAlign: 'left',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 90,
        height: 90,
        background: `radial-gradient(circle at top right, ${accent}55, transparent 60%)`,
        pointerEvents: 'none',
      }}
    />
    <span
      style={{
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        filter: `drop-shadow(0 2px 8px ${accent}aa)`,
      }}
    >
      {icon.endsWith('.png') ? (
        <img
          src={`/assets/home/${icon}`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ fontSize: 30 }}>{icon}</span>
      )}
    </span>
    <div>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: colors.gold[300],
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: colors.ivory[300],
          marginTop: 3,
          opacity: 0.8,
          letterSpacing: 0.3,
        }}
      >
        {subtitle}
      </div>
    </div>
  </motion.button>
);

// ── Main HomePage ─────────────────────────────────────────────────────────────

export const HomePage: React.FC<HomePageProps> = ({ discordId, userId, error }) => {
  const { joinOrCreateGame } = useGame();
  const [phase, setPhase] = useState<'intro' | 'home'>('intro');
  const [homeState, setHomeState] = useState<HomeState>('home');
  const [sheet, setSheet] = useState<SheetKey>(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase('home'), 1300);
    return () => clearTimeout(t);
  }, []);

  const handleFindMatch = async (opts: RankedOptions) => {
    setSheet(null);
    setHomeState('searching');
    await joinOrCreateGame({ ...opts, isPrivate: false, teamSelection: 'random' });
    setHomeState('home');
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: 96,
      }}
    >
      {/* Faint repeating diamond engraving */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(circle at 50% 100%, rgba(212,175,55,0.06) 0%, transparent 55%)',
        }}
      />

      {/* Floating intro cards */}
      {FLOATING_CARDS.map((c, i) => (
        <FloatingCard key={i} {...c} />
      ))}

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, type: 'spring' }}
        style={{ textAlign: 'center', zIndex: 10, marginBottom: 52, position: 'relative' }}
      >
        {/* Ornament above */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 60,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6))',
            }}
          />
          <Diamond size={9} />
          <div
            style={{
              width: 60,
              height: 1,
              background: 'linear-gradient(90deg, rgba(212,175,55,0.6), transparent)',
            }}
          />
        </div>

        <motion.div
          initial={{ scale: 0.65, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 110, damping: 12 }}
          className="casino-gold-text casino-shimmer"
          style={{
            fontFamily: fonts.display,
            fontSize: 'clamp(60px, 11vw, 96px)',
            fontWeight: 900,
            letterSpacing: 6,
            lineHeight: 1,
            textTransform: 'uppercase',
            filter: 'drop-shadow(0 4px 30px rgba(212,175,55,0.45))',
            backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 45%, #8b6914 85%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          DURAK
        </motion.div>

        {/* Ornament below */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 6,
          }}
        >
          <div
            style={{
              width: 40,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6))',
            }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 11,
              fontStyle: 'italic',
              color: colors.ivory[200],
              letterSpacing: 5,
              textTransform: 'uppercase',
              opacity: 0.8,
            }}
          >
            The Fool's Game
          </span>
          <div
            style={{
              width: 40,
              height: 1,
              background: 'linear-gradient(90deg, rgba(212,175,55,0.6), transparent)',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              color: '#ff9999',
              fontSize: 12,
              marginTop: 14,
              fontWeight: 700,
              fontFamily: fonts.body,
              letterSpacing: 0.5,
            }}
          >
            {error}
          </div>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {homeState === 'searching' && (
          <SearchingOverlay
            key="searching"
            label="Seeking Opponents"
            onCancel={() => setHomeState('home')}
          />
        )}

        {homeState === 'home' && phase === 'home' && (
          <motion.div
            key="home-buttons"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
            style={{
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 28,
            }}
          >
            {/* Hero PLAY chip — looks like a casino chip */}
            <motion.button
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setSheet('ranked')}
              style={{
                width: 188,
                height: 188,
                borderRadius: '50%',
                background:
                  'repeating-conic-gradient(from 0deg, #d4af37 0deg 30deg, #8b6914 30deg 60deg)',
                padding: 8,
                border: 'none',
                cursor: 'pointer',
                boxShadow:
                  '0 0 64px rgba(212,175,55,0.5), 0 16px 40px rgba(0,0,0,0.8), inset 0 0 0 2px rgba(0,0,0,0.4)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 30% 25%, #0d4630 0%, #07261a 65%, #04150e 100%)',
                  border: `3px solid ${colors.gold[500]}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  color: colors.gold[300],
                  fontFamily: fonts.display,
                  letterSpacing: 4,
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                }}
              >
                <span style={{ fontSize: 38, lineHeight: 1 }}>♠</span>
                <span style={{ fontSize: 20, fontWeight: 900 }}>PLAY</span>
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: 3,
                    opacity: 0.65,
                    color: colors.ivory[200],
                    textTransform: 'uppercase',
                  }}
                >
                  Ranked
                </span>
              </div>
            </motion.button>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: 460,
                padding: '0 16px',
              }}
            >
              <ModeCard
                icon="home_ranked.png"
                title="Ranked"
                subtitle="Climb the leaderboard"
                accent="rgba(212,175,55,0.55)"
                delay={0.1}
                onClick={() => setSheet('ranked')}
              />
              <ModeCard
                icon="home_custom.png"
                title="Custom"
                subtitle="Private table or browse"
                accent="rgba(139,33,33,0.6)"
                delay={0.17}
                onClick={() => setSheet('custom')}
              />
              <ModeCard
                icon="home_solo.png"
                title="Solo"
                subtitle="Practice against bots"
                accent="rgba(63,138,74,0.55)"
                delay={0.24}
                onClick={() => setSheet('solo')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet === 'ranked' && (
          <Sheet
            title="Ranked Match"
            icon={
              <img
                src="/assets/home/home_ranked.png"
                style={{ width: 26, height: 26, objectFit: 'contain' }}
              />
            }
            onClose={() => setSheet(null)}
          >
            <RankedConfigSheet onFindMatch={handleFindMatch} />
          </Sheet>
        )}
        {sheet === 'custom' && (
          <Sheet
            title="Custom Table"
            icon={
              <img
                src="/assets/home/home_custom.png"
                style={{ width: 26, height: 26, objectFit: 'contain' }}
              />
            }
            onClose={() => setSheet(null)}
          >
            <CustomLobbySheet discordId={discordId} userId={userId} />
          </Sheet>
        )}
        {sheet === 'solo' && (
          <Sheet
            title="Solo Play"
            icon={
              <img
                src="/assets/home/home_solo.png"
                style={{ width: 26, height: 26, objectFit: 'contain' }}
              />
            }
            onClose={() => setSheet(null)}
          >
            <SinglePlayerSheet />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
};
