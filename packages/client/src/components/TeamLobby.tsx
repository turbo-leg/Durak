import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../utils/storage';

interface TeamMember {
  profileId: string;
  username: string;
  avatarUrl: string;
  eloTeams: number;
  role: 'owner' | 'member';
}

interface Team {
  _id: string;
  name: string;
  tag: string;
  eloTeams: number;
  stats: { gamesPlayed: number; wins: number; losses: number };
  members: TeamMember[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onQueueTeamGame?: () => void;
}

async function authHeaders() {
  const raw = await storage.get('durak_auth');
  const token = raw ? JSON.parse(raw).token : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const TeamLobby: React.FC<Props> = ({ open, onClose, onQueueTeamGame }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);
  const [tab, setTab] = useState<'my-team' | 'leaderboard'>('my-team');
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<
    { profileId: string; username: string; avatarUrl: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  const fetchMyTeam = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch('/api/teams/mine', { headers });
    if (res.ok) setTeam(await res.json());
    else setTeam(null);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const res = await fetch('/api/teams');
    if (res.ok) setLeaderboard(await res.json());
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchMyTeam();
    fetchLeaderboard();
  }, [open, fetchMyTeam, fetchLeaderboard]);

  const createTeam = async () => {
    if (!createName.trim() || !createTag.trim()) return;
    setLoading(true);
    const headers = await authHeaders();
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: createName.trim(), tag: createTag.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      fetchMyTeam();
      setCreateName('');
      setCreateTag('');
    } else {
      const d = await res.json();
      flash(d.error || 'Failed to create team');
    }
  };

  const searchPlayers = async (q: string) => {
    setInviteSearch(q);
    if (q.length < 2) return setSearchResults([]);
    const res = await fetch(`/api/profile/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setSearchResults(await res.json());
  };

  const invite = async (targetProfileId: string) => {
    if (!team) return;
    const headers = await authHeaders();
    const res = await fetch(`/api/teams/${team._id}/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetProfileId }),
    });
    flash(res.ok ? 'Invite sent!' : 'Failed to send invite');
    setInviteSearch('');
    setSearchResults([]);
  };

  const leaveOrDisband = async () => {
    if (!team) return;
    const headers = await authHeaders();
    await fetch(`/api/teams/${team._id}/leave`, { method: 'DELETE', headers });
    setTeam(null);
    flash('Left team');
  };

  const TABS = [
    { id: 'my-team', label: 'My Team' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ] as const;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-indigo-950 border-l border-indigo-700 z-50 flex flex-col shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-4 border-b border-indigo-800">
              <h2 className="text-white font-bold text-lg">Teams</h2>
              <button
                onClick={onClose}
                className="text-indigo-300 hover:text-white text-2xl leading-none"
                aria-label="Close teams panel"
              >
                &times;
              </button>
            </div>

            <div className="flex border-b border-indigo-800" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'text-white border-b-2 border-indigo-400'
                      : 'text-indigo-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msg && (
                <div className="bg-indigo-800 text-indigo-100 text-sm px-3 py-2 rounded-lg">
                  {msg}
                </div>
              )}

              {tab === 'my-team' && (
                <>
                  {!team ? (
                    <div className="space-y-3">
                      <p className="text-indigo-300 text-sm">You're not in a team yet.</p>
                      <input
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Team name"
                        className="w-full bg-indigo-900 border border-indigo-700 rounded-lg px-3 py-2 text-white text-sm placeholder-indigo-400"
                      />
                      <input
                        value={createTag}
                        onChange={(e) => setCreateTag(e.target.value.toUpperCase().slice(0, 5))}
                        placeholder="Tag (2-5 chars)"
                        className="w-full bg-indigo-900 border border-indigo-700 rounded-lg px-3 py-2 text-white text-sm placeholder-indigo-400"
                        maxLength={5}
                      />
                      <button
                        onClick={createTeam}
                        disabled={loading || createName.length < 2 || createTag.length < 2}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold"
                      >
                        {loading ? 'Creating…' : 'Create Team'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-indigo-900 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-indigo-700 text-indigo-100 text-xs font-bold px-2 py-0.5 rounded">
                            [{team.tag}]
                          </span>
                          <span className="text-white font-bold">{team.name}</span>
                        </div>
                        <p className="text-indigo-300 text-xs">
                          {team.stats.gamesPlayed} games · {team.stats.wins}W / {team.stats.losses}L
                        </p>
                      </div>

                      <div>
                        <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wide mb-2">
                          Members
                        </p>
                        {team.members.map((m) => (
                          <div key={m.profileId} className="flex items-center gap-2 py-1.5">
                            <img
                              src={m.avatarUrl}
                              alt=""
                              className="w-8 h-8 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=4338ca&color=fff`;
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{m.username}</p>
                              <p className="text-indigo-400 text-xs">{m.eloTeams} ELO</p>
                            </div>
                            {m.role === 'owner' && (
                              <span className="text-yellow-400 text-xs">👑</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div>
                        <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wide mb-2">
                          Invite Player
                        </p>
                        <input
                          value={inviteSearch}
                          onChange={(e) => searchPlayers(e.target.value)}
                          placeholder="Search username…"
                          className="w-full bg-indigo-900 border border-indigo-700 rounded-lg px-3 py-2 text-white text-sm placeholder-indigo-400 mb-1"
                        />
                        {searchResults.map((r) => (
                          <div key={r.profileId} className="flex items-center gap-2 py-1">
                            <img
                              src={r.avatarUrl}
                              alt=""
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(r.username)}&background=4338ca&color=fff`;
                              }}
                            />
                            <span className="text-white text-sm flex-1 truncate">{r.username}</span>
                            <button
                              onClick={() => invite(r.profileId)}
                              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded"
                            >
                              Invite
                            </button>
                          </div>
                        ))}
                      </div>

                      {onQueueTeamGame && (
                        <button
                          onClick={onQueueTeamGame}
                          className="w-full bg-green-600 hover:bg-green-500 text-white rounded-lg py-2 text-sm font-semibold"
                        >
                          Queue Team Game
                        </button>
                      )}

                      <button
                        onClick={leaveOrDisband}
                        className="w-full bg-red-900/50 hover:bg-red-800/60 text-red-300 rounded-lg py-2 text-sm"
                      >
                        Leave / Disband Team
                      </button>
                    </div>
                  )}
                </>
              )}

              {tab === 'leaderboard' && (
                <div className="space-y-2">
                  {leaderboard.length === 0 && (
                    <p className="text-indigo-400 text-sm text-center py-8">No ranked teams yet</p>
                  )}
                  {leaderboard.map((t, i) => (
                    <div
                      key={t._id}
                      className="flex items-center gap-3 bg-indigo-900/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-indigo-400 text-sm w-6 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-indigo-300 text-xs mr-1">[{t.tag}]</span>
                        <span className="text-white text-sm font-medium">{t.name}</span>
                      </div>
                      <span className="text-indigo-200 text-sm font-bold">{t.eloTeams}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
