import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

type ItemType = 'cardBack' | 'tableSkin' | 'emote';

interface ShopItem {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  price: number;
  preview: string;
}

interface ShopState {
  coins: number;
  inventory: string[];
  equippedCardBack: string;
  equippedTableSkin: string;
  equippedEmotes: string[];
}

const API = '/api';
const TABS: { key: ItemType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cardBack', label: 'Card Backs' },
  { key: 'tableSkin', label: 'Table Skins' },
  { key: 'emote', label: 'Emotes' },
];

function ColorSwatch({ color, size = 48 }: { color: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, background: color, borderRadius: 8 }}
      className="border border-white/20 flex items-center justify-center text-2xl"
    />
  );
}

function ItemPreview({ item }: { item: ShopItem }) {
  const isEmoji = !/^#/.test(item.preview);
  if (isEmoji) {
    return (
      <div className="w-12 h-12 rounded-lg bg-indigo-800/60 border border-indigo-600 flex items-center justify-center text-2xl">
        {item.preview}
      </div>
    );
  }
  return <ColorSwatch color={item.preview} />;
}

export const ShopPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [shopState, setShopState] = useState<ShopState | null>(null);
  const [tab, setTab] = useState<ItemType | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const token = user?.token;

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchAll = useCallback(async () => {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const [itemsRes, meRes] = await Promise.all([
      fetch(`${API}/shop/items`),
      token ? fetch(`${API}/shop/me`, { headers }) : Promise.resolve(null),
    ]);
    setItems(itemsRes.ok ? await itemsRes.json() : []);
    if (meRes?.ok) setShopState(await meRes.json());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const buy = async (itemId: string) => {
    if (!token) return showToast('Log in to purchase items', false);
    setBusy(itemId);
    try {
      const res = await fetch(`${API}/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Purchase failed', false);
      } else {
        setShopState((prev) =>
          prev ? { ...prev, coins: data.coins, inventory: data.inventory } : prev,
        );
        showToast('Purchased!', true);
      }
    } finally {
      setBusy(null);
    }
  };

  const equip = async (itemId: string) => {
    if (!token) return showToast('Log in to equip items', false);
    setBusy(itemId);
    try {
      const res = await fetch(`${API}/shop/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Equip failed', false);
      } else {
        setShopState((prev) =>
          prev
            ? {
                ...prev,
                equippedCardBack: data.equippedCardBack,
                equippedTableSkin: data.equippedTableSkin,
                equippedEmotes: data.equippedEmotes,
              }
            : prev,
        );
        showToast('Equipped!', true);
      }
    } finally {
      setBusy(null);
    }
  };

  const isOwned = (id: string) => (shopState?.inventory ?? []).includes(id);

  const isEquipped = (item: ShopItem) => {
    if (item.type === 'cardBack') return shopState?.equippedCardBack === item.id;
    if (item.type === 'tableSkin') return shopState?.equippedTableSkin === item.id;
    if (item.type === 'emote') return (shopState?.equippedEmotes ?? []).includes(item.id);
    return false;
  };

  const filtered = tab === 'all' ? items : items.filter((i) => i.type === tab);

  return (
    <div className="min-h-screen bg-indigo-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-indigo-950/95 backdrop-blur border-b border-indigo-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Shop</h1>
        <div className="flex items-center gap-2 bg-yellow-900/40 border border-yellow-700 rounded-full px-3 py-1">
          <span className="text-yellow-400 text-sm font-bold">🪙</span>
          <span className="text-yellow-300 font-bold text-sm">
            {shopState ? shopState.coins.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-indigo-400 animate-pulse">
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2">
          {filtered.map((item) => {
            const owned = item.price === 0 || isOwned(item.id);
            const equipped = isEquipped(item);
            const isBusy = busy === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl p-4 flex flex-col gap-3 border transition ${
                  equipped
                    ? 'bg-indigo-700/50 border-indigo-400'
                    : 'bg-indigo-900/50 border-indigo-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ItemPreview item={item} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-tight truncate">{item.name}</div>
                    <div className="text-indigo-400 text-xs mt-0.5 leading-snug">
                      {item.description}
                    </div>
                  </div>
                </div>

                {equipped ? (
                  <span className="text-xs font-bold text-indigo-300 bg-indigo-600/40 rounded px-2 py-1 text-center">
                    Equipped
                  </span>
                ) : owned ? (
                  <button
                    onClick={() => void equip(item.id)}
                    disabled={isBusy}
                    className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded px-2 py-1 transition"
                  >
                    {isBusy ? '…' : 'Equip'}
                  </button>
                ) : (
                  <button
                    onClick={() => void buy(item.id)}
                    disabled={isBusy || !token}
                    className="text-xs font-bold bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded px-2 py-1 flex items-center justify-center gap-1 transition"
                  >
                    {isBusy ? (
                      '…'
                    ) : (
                      <>
                        <span>🪙</span>
                        <span>{item.price.toLocaleString()}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg z-50 transition ${
            toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};
