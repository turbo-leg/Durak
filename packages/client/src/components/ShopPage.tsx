import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

type ItemType = 'cardBack' | 'tableSkin' | 'emote';
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

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

const rarityFor = (price: number): Rarity => {
  if (price === 0) return 'common';
  if (price <= 200) return 'uncommon';
  if (price <= 500) return 'rare';
  if (price <= 800) return 'epic';
  return 'legendary';
};

const RARITY = {
  common: {
    border: '#6b7280',
    glow: 'rgba(107,114,128,0.5)',
    bg: '#1f2937',
    label: 'COMMON',
    labelColor: '#9ca3af',
  },
  uncommon: {
    border: '#22c55e',
    glow: 'rgba(34,197,94,0.45)',
    bg: '#052e16',
    label: 'UNCOMMON',
    labelColor: '#4ade80',
  },
  rare: {
    border: '#3b82f6',
    glow: 'rgba(59,130,246,0.5)',
    bg: '#0c1a3a',
    label: 'RARE',
    labelColor: '#60a5fa',
  },
  epic: {
    border: '#a855f7',
    glow: 'rgba(168,85,247,0.55)',
    bg: '#1e0533',
    label: 'EPIC',
    labelColor: '#c084fc',
  },
  legendary: {
    border: '#f59e0b',
    glow: 'rgba(245,158,11,0.6)',
    bg: '#3a1a00',
    label: 'LEGENDARY',
    labelColor: '#fbbf24',
  },
} satisfies Record<
  Rarity,
  { border: string; glow: string; bg: string; label: string; labelColor: string }
>;

// ── Item previews ──────────────────────────────────────────────────────────

function CardBackPreview({ color, rarity }: { color: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        style={{
          width: 72,
          height: 100,
          background: `radial-gradient(ellipse at 30% 30%, color-mix(in srgb, ${color} 70%, white), ${color})`,
          borderRadius: 10,
          border: `2px solid ${r.border}`,
          boxShadow: `0 0 16px ${r.glow}, 0 6px 20px rgba(0,0,0,0.6)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* inner border */}
        <div
          style={{
            position: 'absolute',
            inset: 5,
            border: `1.5px solid rgba(255,255,255,0.2)`,
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          ♦
        </div>
        {/* shine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '45%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
            borderRadius: '10px 10px 0 0',
          }}
        />
      </div>
    </div>
  );
}

function TablePreview({ color, rarity }: { color: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div style={{ position: 'relative', width: 110, height: 70 }}>
        {/* shadow */}
        <div
          style={{
            position: 'absolute',
            bottom: -4,
            left: 4,
            right: 4,
            height: 16,
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '50%',
            filter: 'blur(6px)',
          }}
        />
        {/* table surface */}
        <div
          style={{
            width: '100%',
            height: '100%',
            background: `radial-gradient(ellipse at 35% 35%, color-mix(in srgb, ${color} 60%, white 40%), ${color} 70%)`,
            borderRadius: '50%',
            border: `3px solid ${r.border}`,
            boxShadow: `0 0 14px ${r.glow}, inset 0 0 24px rgba(0,0,0,0.35)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* felt lines */}
          <div
            style={{
              width: '60%',
              height: '60%',
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EmotePreview({ emoji, rarity }: { emoji: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        style={{
          width: 88,
          height: 88,
          background: `radial-gradient(circle at 40% 35%, ${r.bg}, #0d0d1a 80%)`,
          borderRadius: '50%',
          border: `2px solid ${r.border}`,
          boxShadow: `0 0 20px ${r.glow}, 0 6px 20px rgba(0,0,0,0.5)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
        }}
      >
        {emoji}
      </div>
    </div>
  );
}

function ItemPreview({ item, rarity }: { item: ShopItem; rarity: Rarity }) {
  const isEmoji = !/^#/.test(item.preview);
  if (isEmoji) return <EmotePreview emoji={item.preview} rarity={rarity} />;
  if (item.type === 'cardBack') return <CardBackPreview color={item.preview} rarity={rarity} />;
  return <TablePreview color={item.preview} rarity={rarity} />;
}

// ── Main component ─────────────────────────────────────────────────────────

const TABS = [
  { key: 'all' as const, label: 'All', icon: '🏪' },
  { key: 'cardBack' as const, label: 'Card Backs', icon: '🃏' },
  { key: 'tableSkin' as const, label: 'Tables', icon: '🎯' },
  { key: 'emote' as const, label: 'Emotes', icon: '😄' },
];

export const ShopPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [shopState, setShopState] = useState<ShopState | null>(null);
  const [tab, setTab] = useState<ItemType | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ShopItem | null>(null);

  const token = user?.token;

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }, []);

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
    if (!token) {
      showToast('Sign in to buy items', false);
      return;
    }
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
        showToast('Purchased! ✓', true);
      }
    } finally {
      setBusy(null);
    }
  };

  const equip = async (itemId: string) => {
    if (!token) {
      showToast('Sign in to equip items', false);
      return;
    }
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
        showToast('Equipped! ✓', true);
        setSelected(null);
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
    <div style={{ background: '#0d0d1a', minHeight: '100vh', color: 'white', paddingBottom: 100 }}>
      {/* ── Header ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #1a0a3a 0%, #0d0d1a 100%)',
          padding: '20px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>
              <span
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #fcd34d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                DURAK
              </span>
              <span style={{ color: 'white', marginLeft: 6 }}>STORE</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              Play games to earn coins
            </div>
          </div>

          {/* Coin balance */}
          <div
            style={{
              background: 'linear-gradient(135deg, #78350f, #451a03)',
              border: '1.5px solid #f59e0b',
              borderRadius: 999,
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 0 12px rgba(245,158,11,0.35)',
            }}
          >
            <span style={{ fontSize: 16 }}>🪙</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#fcd34d' }}>
              {shopState ? shopState.coins.toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {/* Category tabs */}
        <div
          style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto', paddingBottom: 2 }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  border: active
                    ? '1.5px solid rgba(139,92,246,0.8)'
                    : '1.5px solid rgba(255,255,255,0.08)',
                  background: active
                    ? 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(109,40,217,0.35))'
                    : 'rgba(255,255,255,0.04)',
                  color: active ? '#e9d5ff' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: active ? '0 0 10px rgba(139,92,246,0.3)' : 'none',
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 300,
            color: 'rgba(255,255,255,0.3)',
            fontSize: 14,
          }}
        >
          Loading…
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            padding: '16px 12px',
          }}
        >
          {filtered.map((item) => {
            const rarity = rarityFor(item.price);
            const r = RARITY[rarity];
            const owned = item.price === 0 || isOwned(item.id);
            const equipped = isEquipped(item);
            const isBusy = busy === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                style={{
                  background: `linear-gradient(180deg, ${r.bg} 0%, #0d0d1a 100%)`,
                  border: `1.5px solid ${equipped ? r.border : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0,
                  position: 'relative',
                  boxShadow: equipped
                    ? `0 0 18px ${r.glow}, 0 4px 16px rgba(0,0,0,0.5)`
                    : '0 4px 16px rgba(0,0,0,0.4)',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  transform: 'translateZ(0)',
                }}
              >
                {/* EQUIPPED badge */}
                {equipped && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 2,
                      background: r.border,
                      color: '#000',
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: 0.5,
                      padding: '2px 7px',
                      borderRadius: 999,
                    }}
                  >
                    EQUIPPED
                  </div>
                )}

                {/* Rarity stripe */}
                <div
                  style={{
                    height: 3,
                    background: `linear-gradient(90deg, transparent, ${r.border}, transparent)`,
                  }}
                />

                {/* Preview area */}
                <div
                  style={{
                    height: 130,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    background: `radial-gradient(ellipse at 50% 60%, ${r.glow.replace(')', ', 0.15)').replace('rgba', 'rgba')} 0%, transparent 70%)`,
                  }}
                >
                  <ItemPreview item={item} rarity={rarity} />
                </div>

                {/* Info area */}
                <div style={{ padding: '10px 12px 12px' }}>
                  {/* Rarity label */}
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 1,
                      color: r.labelColor,
                      marginBottom: 3,
                    }}
                  >
                    {r.label}
                  </div>
                  {/* Name */}
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'white',
                      lineHeight: 1.2,
                      marginBottom: 10,
                    }}
                  >
                    {item.name}
                  </div>

                  {/* Action */}
                  {equipped ? (
                    <div
                      style={{
                        background: `linear-gradient(90deg, ${r.border}33, ${r.border}55)`,
                        border: `1px solid ${r.border}66`,
                        borderRadius: 8,
                        padding: '7px 0',
                        fontSize: 12,
                        fontWeight: 700,
                        color: r.border,
                        textAlign: 'center',
                      }}
                    >
                      ✓ Equipped
                    </div>
                  ) : owned ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        void equip(item.id);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        borderRadius: 8,
                        padding: '7px 0',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'white',
                        textAlign: 'center',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.6 : 1,
                        boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
                      }}
                    >
                      {isBusy ? '…' : 'Equip'}
                    </div>
                  ) : item.price === 0 ? (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #065f46, #047857)',
                        borderRadius: 8,
                        padding: '7px 0',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#6ee7b7',
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                      }}
                    >
                      FREE
                    </div>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        void buy(item.id);
                      }}
                      style={{
                        background: isBusy
                          ? 'rgba(255,255,255,0.1)'
                          : 'linear-gradient(135deg, #b45309, #d97706)',
                        borderRadius: 8,
                        padding: '7px 0',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#fef3c7',
                        textAlign: 'center',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        boxShadow: isBusy ? 'none' : '0 2px 8px rgba(180,83,9,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy ? (
                        '…'
                      ) : (
                        <>
                          <span>🪙</span>
                          <span>{item.price.toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Detail modal ── */}
      {selected &&
        (() => {
          const item = selected;
          const rarity = rarityFor(item.price);
          const r = RARITY[rarity];
          const owned = item.price === 0 || isOwned(item.id);
          const equipped = isEquipped(item);
          const isBusy = busy === item.id;
          return (
            <div
              onClick={() => setSelected(null)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 50,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: `linear-gradient(180deg, ${r.bg} 0%, #0f0f1a 60%)`,
                  border: `1.5px solid ${r.border}`,
                  borderRadius: '20px 20px 0 0',
                  width: '100%',
                  maxWidth: 480,
                  padding: '24px 20px 36px',
                  boxShadow: `0 -8px 40px ${r.glow}`,
                }}
              >
                {/* drag handle */}
                <div
                  style={{
                    width: 36,
                    height: 4,
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: 999,
                    margin: '0 auto 20px',
                  }}
                />

                <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ width: 100, height: 100, flexShrink: 0 }}>
                    <ItemPreview item={item} rarity={rarity} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 1,
                        color: r.labelColor,
                        marginBottom: 4,
                      }}
                    >
                      {r.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1.1 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
                      {item.description}
                    </div>
                  </div>
                </div>

                {equipped ? (
                  <div
                    style={{
                      padding: '14px',
                      border: `1px solid ${r.border}55`,
                      borderRadius: 12,
                      textAlign: 'center',
                      color: r.border,
                      fontWeight: 700,
                      fontSize: 15,
                      background: `${r.border}11`,
                    }}
                  >
                    ✓ Currently Equipped
                  </div>
                ) : owned ? (
                  <button
                    disabled={isBusy}
                    onClick={() => void equip(item.id)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 16,
                      fontWeight: 800,
                      color: 'white',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    {isBusy ? 'Equipping…' : 'Equip Now'}
                  </button>
                ) : (
                  <button
                    disabled={isBusy || !token}
                    onClick={() => void buy(item.id)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background:
                        !token || isBusy
                          ? 'rgba(255,255,255,0.08)'
                          : 'linear-gradient(135deg, #b45309, #d97706)',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#fef3c7',
                      cursor: !token || isBusy ? 'not-allowed' : 'pointer',
                      boxShadow: !token || isBusy ? 'none' : '0 4px 16px rgba(180,83,9,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      opacity: !token || isBusy ? 0.5 : 1,
                    }}
                  >
                    {isBusy ? (
                      'Buying…'
                    ) : !token ? (
                      'Sign in to buy'
                    ) : (
                      <>
                        <span style={{ fontSize: 18 }}>🪙</span>
                        <span>{item.price.toLocaleString()}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.ok ? '#065f46' : '#7f1d1d',
            border: `1px solid ${toast.ok ? '#10b981' : '#ef4444'}`,
            color: toast.ok ? '#6ee7b7' : '#fca5a5',
            padding: '10px 20px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            zIndex: 60,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};
