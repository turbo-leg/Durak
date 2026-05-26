import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../utils/storage';

type NotificationKind = 'friend_request' | 'team_invite';

interface Notification {
  id: string;
  kind: NotificationKind;
  fromUsername: string;
  fromAvatarUrl: string;
  payload: { friendshipId?: string; teamId?: string; teamName?: string };
  createdAt: string;
  read: boolean;
}

interface Props {
  onOpenFriends?: () => void;
}

const API_BASE = import.meta.env.VITE_SERVER_URL ?? '';
const POLL_INTERVAL = 30000;

async function getToken(): Promise<string | null> {
  const raw = await storage.get('durak_auth');
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

async function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...(opts?.headers ?? {}), Authorization: `Bearer ${token ?? ''}` },
  });
}

export function NotificationBell({ onOpenFriends }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authFetch('/api/notifications');
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: Notification[]; unreadCount: number };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silently ignore network errors
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open && unreadCount > 0) {
      setUnreadCount(0);
      await authFetch('/api/notifications/mark-read', { method: 'POST' });
    }
  }

  async function acceptTeamInvite(teamId: string) {
    await authFetch(`/api/teams/${teamId}/accept`, { method: 'POST' });
    await fetchNotifications();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-800 transition-colors"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 rounded-xl border border-indigo-700 bg-indigo-950 shadow-xl z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-indigo-800">
              <p className="text-sm font-semibold text-indigo-200">Notifications</p>
            </div>

            <ul className="max-h-72 overflow-y-auto divide-y divide-indigo-900">
              {notifications.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-indigo-400">
                  No new notifications
                </li>
              ) : (
                notifications.map((n) => (
                  <li
                    key={n.id}
                    className="px-4 py-3 bg-indigo-900 hover:bg-indigo-800 transition-colors"
                  >
                    {n.kind === 'friend_request' && (
                      <button
                        className="flex items-center gap-3 w-full text-left"
                        onClick={() => {
                          setOpen(false);
                          onOpenFriends?.();
                        }}
                      >
                        {n.fromAvatarUrl ? (
                          <img
                            src={n.fromAvatarUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-indigo-700 shrink-0" />
                        )}
                        <span className="text-sm text-indigo-100">
                          <span className="font-medium">{n.fromUsername}</span> sent you a friend
                          request
                        </span>
                      </button>
                    )}

                    {n.kind === 'team_invite' && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-indigo-100">
                          Invited to team <span className="font-medium">{n.payload.teamName}</span>
                        </span>
                        <button
                          className="shrink-0 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                          onClick={() => n.payload.teamId && acceptTeamInvite(n.payload.teamId)}
                        >
                          Accept
                        </button>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
