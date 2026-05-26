import React, { useEffect, useState, useCallback } from 'react';

interface ShopItem {
  id: string;
  name: string;
  type: 'card_back' | 'avatar_frame' | 'emote';
  price: number;
  preview: string;
}

interface Props {
  discordId?: string;
  userId?: string;
}

const API = '/api';
const TYPE_LABELS: Record<ShopItem['type'], string> = {
  card_back: 'Card Backs',
  avatar_frame: 'Avatar Frames',
  emote: 'Emotes',
};
const TYPE_ORDER: ShopItem['type'][] = ['card_back', 'avatar_frame', 'emote'];

export const ShopScreen: React.FC<Props> = ({ discordId, userId }) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  const [equippedCardBack, setEquippedCardBack] = useState<string>('');
  const [equippedAvatarFrame, setEquippedAvatarFrame] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseMsg, setPurchaseMsg] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  const id = discordId ?? userId ?? '';
  const byParam = userId && !discordId ? 'by=user' : '';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API}/shop/items`).then((r) => (r.ok ? (r.json() as Promise<ShopItem[]>) : [])),
      fetch(`${API}/profile/${id}${byParam ? `?${byParam}` : ''}`).then((r) =>
        r.ok
          ? (r.json() as Promise<{
              coins: number;
              ownedItems?: string[];
              equippedCardBack?: string;
              equippedAvatarFrame?: string;
            }>)
          : null,
      ),
    ])
      .then(([shopItems, profile]) => {
        if (cancelled) return;
        setItems(Array.isArray(shopItems) ? shopItems : []);
        setBalance(profile?.coins ?? null);
        setOwnedItems(profile?.ownedItems ?? []);
        setEquippedCardBack(profile?.equippedCardBack ?? '');
        setEquippedAvatarFrame(profile?.equippedAvatarFrame ?? '');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load shop. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, byParam]);

  const handleBuy = useCallback(
    async (item: ShopItem) => {
      if (!id) return;
      setPurchasing(item.id);
      setPurchaseMsg(null);
      try {
        const body: Record<string, string> = { itemId: item.id };
        if (discordId) body.discordId = discordId;
        else if (userId) body.userId = userId;

        const res = await fetch(`${API}/shop/purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          balance?: number;
          ownedItems?: string[];
          error?: string;
        };

        if (!res.ok || !data.ok) {
          setPurchaseMsg(data.error ?? 'Purchase failed.');
        } else {
          setBalance(data.balance ?? null);
          setOwnedItems(data.ownedItems ?? []);
          setPurchaseMsg(`Purchased ${item.name}!`);
        }
      } catch {
        setPurchaseMsg('Network error. Please try again.');
      } finally {
        setPurchasing(null);
      }
    },
    [id, discordId, userId],
  );

  const handleEquip = useCallback(
    async (item: ShopItem) => {
      if (!id || (item.type !== 'card_back' && item.type !== 'avatar_frame')) return;
      setEquipping(item.id);
      try {
        const body: Record<string, string> = { itemId: item.id, slot: item.type };
        if (discordId) body.discordId = discordId;
        else if (userId) body.userId = userId;

        const res = await fetch(`${API}/profile/equip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          equipped?: { card_back: string; avatar_frame: string };
          error?: string;
        };

        if (res.ok && data.ok && data.equipped) {
          setEquippedCardBack(data.equipped.card_back);
          setEquippedAvatarFrame(data.equipped.avatar_frame);
        }
      } catch {
        // silently ignore equip errors
      } finally {
        setEquipping(null);
      }
    },
    [id, discordId, userId],
  );

  if (loading) {
    return (
      <div className="text-indigo-400 text-sm text-center py-6 animate-pulse">Loading shop…</div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm text-center py-6">{error}</div>;
  }

  const grouped = TYPE_ORDER.reduce<Record<ShopItem['type'], ShopItem[]>>(
    (acc, type) => {
      acc[type] = items.filter((i) => i.type === type);
      return acc;
    },
    { card_back: [], avatar_frame: [], emote: [] },
  );

  return (
    <div className="space-y-4">
      {/* Coin balance */}
      <div className="flex items-center gap-2 bg-indigo-900/60 rounded-lg px-4 py-2">
        <span className="text-yellow-400 text-lg">🪙</span>
        <span className="text-white font-bold text-lg">
          {balance !== null ? balance.toLocaleString() : '—'}
        </span>
        <span className="text-indigo-400 text-xs">coins</span>
      </div>

      {purchaseMsg && (
        <div
          className={`text-xs px-3 py-2 rounded ${
            purchaseMsg.startsWith('Purchased')
              ? 'bg-green-900/60 text-green-300'
              : 'bg-red-900/60 text-red-300'
          }`}
        >
          {purchaseMsg}
        </div>
      )}

      {/* Item groups */}
      {TYPE_ORDER.map((type) => {
        const group = grouped[type];
        if (group.length === 0) return null;
        return (
          <div key={type}>
            <div className="text-indigo-400 text-xs font-semibold mb-2">{TYPE_LABELS[type]}</div>
            <div className="grid grid-cols-2 gap-2">
              {group.map((item) => {
                const owned = ownedItems.includes(item.id);
                const isBuying = purchasing === item.id;
                const isEquipping = equipping === item.id;
                const canAfford = balance !== null && balance >= item.price;
                const isEquippable = item.type === 'card_back' || item.type === 'avatar_frame';
                const isEquipped =
                  (item.type === 'card_back' && equippedCardBack === item.id) ||
                  (item.type === 'avatar_frame' && equippedAvatarFrame === item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-indigo-900/60 border border-indigo-700 rounded-lg p-3 flex flex-col items-center gap-2 text-center"
                  >
                    <div className="text-2xl">{item.preview}</div>
                    <div className="text-white text-xs font-semibold leading-tight">
                      {item.name}
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                      <span>🪙</span>
                      <span>{item.price}</span>
                    </div>
                    {owned ? (
                      <div className="flex flex-col items-center gap-1 w-full">
                        <div className="flex items-center gap-1">
                          <span className="text-xs bg-green-800/70 text-green-300 rounded-full px-2 py-0.5 font-semibold">
                            Owned
                          </span>
                          {isEquipped && (
                            <span className="text-green-400 text-xs font-bold">✓</span>
                          )}
                        </div>
                        {isEquippable && !isEquipped && (
                          <button
                            onClick={() => handleEquip(item)}
                            disabled={isEquipping}
                            className={`text-xs px-3 py-1 rounded font-semibold transition w-full ${
                              isEquipping
                                ? 'bg-indigo-700 text-indigo-400 cursor-wait'
                                : 'bg-purple-700 hover:bg-purple-600 text-white'
                            }`}
                          >
                            {isEquipping ? '…' : 'Equip'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={isBuying || !canAfford}
                        className={`text-xs px-3 py-1 rounded font-semibold transition ${
                          isBuying
                            ? 'bg-indigo-700 text-indigo-400 cursor-wait'
                            : canAfford
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              : 'bg-indigo-900 text-indigo-500 cursor-not-allowed'
                        }`}
                      >
                        {isBuying ? '…' : canAfford ? 'Buy' : 'Need coins'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
