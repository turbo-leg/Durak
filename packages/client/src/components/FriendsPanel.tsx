import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { storage } from '../utils/storage';

interface Friend {
  profileId: string;
  username: string;
  avatarUrl: string;
  eloClassic: number;
}

interface PendingRequest {
  friendshipId: string;
  from: { profileId: string; username: string; avatarUrl: string };
}

interface SearchResult {
  profileId: string;
  username: string;
  avatarUrl: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'friends' | 'pending' | 'add';

const API = '/api';

async function authHeaders(): Promise<Record<string, string>> {
  const raw = await storage.get('durak_auth');
  const auth = JSON.parse(raw ?? '{}') as { token?: string };
  return { Authorization: `Bearer ${auth.token ?? ''}`, 'Content-Type': 'application/json' };
}

const Avatar: React.FC<{ url: string; username: string }> = ({ url, username }) => (
  <img
    src={url}
    alt={username}
    className="w-8 h-8 rounded-full object-cover bg-indigo-800 shrink-0"
    onError={(e) => {
      (e.currentTarget as HTMLImageElement).src =
        `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4338ca&color=fff&size=32`;
    }}
  />
);

export const FriendsPanel: React.FC<Props> = ({ open, onClose }) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [actionIds, setActionIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/friends`, { headers });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Friend[];
      setFriends(data);
    } catch {
      setError('Failed to load friends.');
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/friends/pending`, { headers });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as PendingRequest[];
      setPending(data);
    } catch {
      setError('Failed to load requests.');
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (tab === 'friends') fetchFriends();
    else if (tab === 'pending') fetchPending();
  }, [open, tab, fetchFriends, fetchPending]);

  const handleRemove = useCallback(async (profileId: string) => {
    setActionIds((prev) => new Set(prev).add(profileId));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/friends/${profileId}`, { method: 'DELETE', headers });
      if (res.ok) setFriends((prev) => prev.filter((f) => f.profileId !== profileId));
    } finally {
      setActionIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }, []);

  const handleAccept = useCallback(async (friendshipId: string) => {
    setActionIds((prev) => new Set(prev).add(friendshipId));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/friends/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ friendshipId }),
      });
      if (res.ok) setPending((prev) => prev.filter((p) => p.friendshipId !== friendshipId));
    } finally {
      setActionIds((prev) => {
        const next = new Set(prev);
        next.delete(friendshipId);
        return next;
      });
    }
  }, []);

  const handleReject = useCallback(async (friendshipId: string) => {
    setActionIds((prev) => new Set(prev).add(friendshipId));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/friends/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ friendshipId }),
      });
      if (res.ok) setPending((prev) => prev.filter((p) => p.friendshipId !== friendshipId));
    } finally {
      setActionIds((prev) => {
        const next = new Set(prev);
        next.delete(friendshipId);
        return next;
      });
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/profile/search?q=${encodeURIComponent(searchQuery.trim())}`, {
        headers,
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SearchResult[];
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleAddFriend = useCallback(async (targetProfileId: string) => {
    setActionIds((prev) => new Set(prev).add(targetProfileId));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/friends/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetProfileId }),
      });
      if (res.ok) setAddedIds((prev) => new Set(prev).add(targetProfileId));
    } finally {
      setActionIds((prev) => {
        const next = new Set(prev);
        next.delete(targetProfileId);
        return next;
      });
    }
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'friends', label: 'Friends' },
    { key: 'pending', label: 'Pending' },
    { key: 'add', label: 'Add Friend' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-80 bg-indigo-950 border-l border-indigo-800 z-50 flex flex-col shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-800">
              <span className="text-white font-bold text-base">Friends</span>
              <button
                onClick={onClose}
                className="text-indigo-400 hover:text-white transition text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex border-b border-indigo-800">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold transition ${
                    tab === key
                      ? 'text-white border-b-2 border-indigo-400'
                      : 'text-indigo-400 hover:text-indigo-200'
                  }`}
                >
                  {label}
                  {key === 'pending' && pending.length > 0 && (
                    <span className="ml-1 bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5">
                      {pending.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {error && <div className="text-red-400 text-xs text-center py-2">{error}</div>}

              {tab === 'friends' && (
                <>
                  {loadingFriends ? (
                    <div className="text-indigo-400 text-xs text-center py-6 animate-pulse">
                      Loading…
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="text-indigo-400 text-xs text-center py-6">
                      No friends yet — add some!
                    </div>
                  ) : (
                    friends.map((f) => (
                      <div
                        key={f.profileId}
                        className="flex items-center gap-3 bg-indigo-900/60 border border-indigo-800 rounded-lg px-3 py-2"
                      >
                        <Avatar url={f.avatarUrl} username={f.username} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">
                            {f.username}
                          </div>
                          <div className="text-indigo-400 text-xs">{f.eloClassic} ELO</div>
                        </div>
                        <button
                          onClick={() => handleRemove(f.profileId)}
                          disabled={actionIds.has(f.profileId)}
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition shrink-0"
                        >
                          {actionIds.has(f.profileId) ? '…' : 'Remove'}
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {tab === 'pending' && (
                <>
                  {loadingPending ? (
                    <div className="text-indigo-400 text-xs text-center py-6 animate-pulse">
                      Loading…
                    </div>
                  ) : pending.length === 0 ? (
                    <div className="text-indigo-400 text-xs text-center py-6">
                      No pending requests.
                    </div>
                  ) : (
                    pending.map((req) => (
                      <div
                        key={req.friendshipId}
                        className="flex items-center gap-3 bg-indigo-900/60 border border-indigo-800 rounded-lg px-3 py-2"
                      >
                        <Avatar url={req.from.avatarUrl} username={req.from.username} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">
                            {req.from.username}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleAccept(req.friendshipId)}
                            disabled={actionIds.has(req.friendshipId)}
                            className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-2 py-1 rounded transition"
                          >
                            {actionIds.has(req.friendshipId) ? '…' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleReject(req.friendshipId)}
                            disabled={actionIds.has(req.friendshipId)}
                            className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white px-2 py-1 rounded transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {tab === 'add' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                      }}
                      placeholder="Search username…"
                      className="flex-1 bg-indigo-900/60 border border-indigo-700 rounded-lg px-3 py-2 text-white text-sm placeholder-indigo-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || !searchQuery.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs px-3 py-2 rounded-lg font-semibold transition"
                    >
                      {searching ? '…' : 'Search'}
                    </button>
                  </div>

                  {searchResults.map((result) => {
                    const added = addedIds.has(result.profileId);
                    const acting = actionIds.has(result.profileId);
                    return (
                      <div
                        key={result.profileId}
                        className="flex items-center gap-3 bg-indigo-900/60 border border-indigo-800 rounded-lg px-3 py-2"
                      >
                        <Avatar url={result.avatarUrl} username={result.username} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">
                            {result.username}
                          </div>
                        </div>
                        {added ? (
                          <span className="text-xs text-green-400 font-semibold shrink-0">
                            Sent!
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddFriend(result.profileId)}
                            disabled={acting}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-2 py-1 rounded transition shrink-0"
                          >
                            {acting ? '…' : 'Add'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
