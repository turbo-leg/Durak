import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

type ItemType = 'cardBack' | 'tableSkin' | 'emote';
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

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
  if (price <= 300) return 'rare';
  if (price <= 700) return 'epic';
  return 'legendary';
};

const RARITY: Record<
  Rarity,
  {
    cardGradient: string;
    border: string;
    topBar: string;
    glow: string;
    label: string;
    stars: number;
    starColor: string;
  }
> = {
  common: {
    cardGradient: 'linear-gradient(175deg, #4b5563 0%, #1f2937 55%, #111827 100%)',
    border: '#6b7280',
    topBar: 'linear-gradient(90deg, #374151, #6b7280, #374151)',
    glow: 'rgba(107,114,128,0.45)',
    label: 'COMMON',
    stars: 1,
    starColor: '#9ca3af',
  },
  rare: {
    cardGradient: 'linear-gradient(175deg, #2563eb 0%, #1e3a8a 55%, #0f1f57 100%)',
    border: '#3b82f6',
    topBar: 'linear-gradient(90deg, #1e3a8a, #60a5fa, #1e3a8a)',
    glow: 'rgba(59,130,246,0.55)',
    label: 'RARE',
    stars: 2,
    starColor: '#93c5fd',
  },
  epic: {
    cardGradient: 'linear-gradient(175deg, #7c3aed 0%, #4c1d95 55%, #2e1065 100%)',
    border: '#a855f7',
    topBar: 'linear-gradient(90deg, #4c1d95, #c084fc, #4c1d95)',
    glow: 'rgba(168,85,247,0.6)',
    label: 'EPIC',
    stars: 3,
    starColor: '#d8b4fe',
  },
  legendary: {
    cardGradient: 'linear-gradient(175deg, #d97706 0%, #92400e 55%, #451a03 100%)',
    border: '#f59e0b',
    topBar: 'linear-gradient(90deg, #92400e, #fbbf24, #92400e)',
    glow: 'rgba(245,158,11,0.7)',
    label: 'LEGENDARY',
    stars: 3,
    starColor: '#fcd34d',
  },
};

// ── Item art ──────────────────────────────────────────────────────────────

function CardArt({ color, rarity }: { color: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div style={{ position: 'relative', width: 68, height: 92 }}>
      {/* outer card shape */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 9,
          background: `radial-gradient(ellipse at 35% 28%, color-mix(in srgb, ${color} 55%, white 45%), ${color} 80%)`,
          border: `2px solid rgba(255,255,255,0.25)`,
          boxShadow: `0 8px 24px rgba(0,0,0,0.7), 0 0 18px ${r.glow}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* shine overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '42%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
            borderRadius: '9px 9px 0 0',
          }}
        />
        {/* inner frame */}
        <div
          style={{
            position: 'absolute',
            inset: 6,
            border: '1.5px solid rgba(255,255,255,0.18)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>♦</div>
          <div
            style={{
              fontSize: 8,
              letterSpacing: 2,
              color: 'rgba(255,255,255,0.3)',
              fontWeight: 800,
            }}
          >
            DURAK
          </div>
        </div>
      </div>
      {/* corner pips */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: 5,
          fontSize: 8,
          color: 'rgba(255,255,255,0.5)',
          fontWeight: 900,
        }}
      >
        ♦
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 3,
          right: 5,
          fontSize: 8,
          color: 'rgba(255,255,255,0.5)',
          fontWeight: 900,
          transform: 'rotate(180deg)',
        }}
      >
        ♦
      </div>
    </div>
  );
}

function TableArt({ color, rarity }: { color: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div style={{ position: 'relative', width: 108, height: 72 }}>
      {/* drop shadow */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: 10,
          right: 10,
          height: 14,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          filter: 'blur(8px)',
        }}
      />
      {/* table surface */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at 32% 30%, color-mix(in srgb, ${color} 50%, white 50%), ${color} 65%, color-mix(in srgb, ${color} 80%, black) 100%)`,
          border: `3px solid ${r.border}`,
          boxShadow: `0 0 20px ${r.glow}, inset 0 0 20px rgba(0,0,0,0.4)`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* shine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '45%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
            borderRadius: '50% 50% 0 0 / 30% 30% 0 0',
          }}
        />
        {/* inner ring */}
        <div
          style={{
            width: '55%',
            height: '55%',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.12)',
          }}
        />
      </div>
    </div>
  );
}

function EmoteArt({ emoji, rarity }: { emoji: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div
      style={{
        width: 90,
        height: 90,
        borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.08), rgba(0,0,0,0.4))`,
        border: `2.5px solid ${r.border}`,
        boxShadow: `0 0 24px ${r.glow}, 0 8px 24px rgba(0,0,0,0.6)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 46,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '45%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
          borderRadius: '50% 50% 0 0 / 30% 30% 0 0',
        }}
      />
      {emoji}
    </div>
  );
}

function ItemArt({ item, rarity }: { item: ShopItem; rarity: Rarity }) {
  const isEmoji = !/^#/.test(item.preview);
  if (isEmoji) return <EmoteArt emoji={item.preview} rarity={rarity} />;
  if (item.type === 'cardBack') return <CardArt color={item.preview} rarity={rarity} />;
  return <TableArt color={item.preview} rarity={rarity} />;
}

function Stars({ count, color }: { count: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: 10,
            color: i < count ? color : 'rgba(255,255,255,0.15)',
            textShadow: i < count ? `0 0 6px ${color}` : 'none',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ── Shop card ─────────────────────────────────────────────────────────────

function ShopCard({
  item,
  owned,
  equipped,
  busy,
  onBuy,
  onEquip,
  onClick,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  busy: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onClick: () => void;
}) {
  const rarity = rarityFor(item.price);
  const r = RARITY[rarity];
  const free = item.price === 0;

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: `2px solid ${equipped ? r.border : 'rgba(255,255,255,0.08)'}`,
        boxShadow: equipped
          ? `0 0 22px ${r.glow}, 0 6px 20px rgba(0,0,0,0.6)`
          : `0 6px 20px rgba(0,0,0,0.5)`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform 0.1s',
        userSelect: 'none',
      }}
    >
      {/* Rarity top bar */}
      <div style={{ height: 5, background: r.topBar }} />

      {/* Art area */}
      <div
        style={{
          background: r.cardGradient,
          height: 148,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* ambient glow behind art */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 50% 60%, ${r.glow.replace('0.', '0.08,')} 0%, transparent 70%)`,
          }}
        />
        <ItemArt item={item} rarity={rarity} />

        {/* EQUIPPED badge */}
        {equipped && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: r.border,
              color: '#000',
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.8,
              padding: '2px 7px',
              borderRadius: 999,
              boxShadow: `0 2px 8px ${r.glow}`,
            }}
          >
            ✓ ON
          </div>
        )}

        {/* NEW badge for legendaries */}
        {rarity === 'legendary' && !owned && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: '#fff',
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.5,
              padding: '2px 7px',
              borderRadius: 999,
            }}
          >
            HOT
          </div>
        )}
      </div>

      {/* Info + action area */}
      <div
        style={{
          background: 'linear-gradient(180deg, #0f0f1e 0%, #080812 100%)',
          padding: '10px 10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Name + stars row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.2,
              flex: 1,
              paddingRight: 4,
            }}
          >
            {item.name}
          </div>
          <Stars count={r.stars} color={r.starColor} />
        </div>

        {/* CTA button */}
        {equipped ? (
          <div
            style={{
              background: `linear-gradient(180deg, ${r.border}22 0%, ${r.border}11 100%)`,
              border: `1.5px solid ${r.border}55`,
              borderRadius: 10,
              padding: '8px 0',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: r.border,
              letterSpacing: 0.5,
            }}
          >
            ✓ EQUIPPED
          </div>
        ) : owned || free ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEquip();
            }}
            disabled={busy}
            style={{
              width: '100%',
              background: busy
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)',
              border: 'none',
              borderTop: '2px solid rgba(167,139,250,0.5)',
              borderBottom: '3px solid #2e1065',
              borderRadius: 10,
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 900,
              color: '#ede9fe',
              letterSpacing: 0.5,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
            }}
          >
            {busy ? '…' : free ? '+ EQUIP FREE' : 'EQUIP'}
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBuy();
            }}
            disabled={busy}
            style={{
              width: '100%',
              background: busy
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderTop: '2px solid #fcd34d',
              borderBottom: '3px solid #92400e',
              borderRadius: 10,
              padding: '8px 0',
              fontSize: 13,
              fontWeight: 900,
              color: '#1c0a00',
              letterSpacing: 0.3,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(245,158,11,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            {busy ? (
              '…'
            ) : (
              <>
                <span style={{ fontSize: 14 }}>🪙</span>
                <span>{item.price.toLocaleString()}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 12px 10px' }}>
      <div
        style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12))',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div
        style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.12), transparent)',
        }}
      />
    </div>
  );
}

// ── Detail bottom sheet ───────────────────────────────────────────────────

function DetailSheet({
  item,
  owned,
  equipped,
  busy,
  coins,
  token,
  onBuy,
  onEquip,
  onClose,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  busy: boolean;
  coins: number;
  token?: string;
  onBuy: () => void;
  onEquip: () => void;
  onClose: () => void;
}) {
  const rarity = rarityFor(item.price);
  const r = RARITY[rarity];
  const free = item.price === 0;
  const canAfford = coins >= item.price;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'linear-gradient(180deg, #15102e 0%, #0a0a18 100%)',
          border: `2px solid ${r.border}`,
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 36px',
          boxShadow: `0 -12px 50px ${r.glow}, 0 -4px 20px rgba(0,0,0,0.8)`,
          overflow: 'hidden',
        }}
      >
        {/* top rarity bar */}
        <div style={{ height: 6, background: r.topBar }} />

        {/* drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div
            style={{
              width: 40,
              height: 4,
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
            }}
          />
        </div>

        {/* content */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
            {/* Art */}
            <div
              style={{
                width: 110,
                height: 110,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: r.cardGradient,
                borderRadius: 16,
                border: `2px solid ${r.border}44`,
                boxShadow: `0 0 20px ${r.glow}`,
              }}
            >
              <ItemArt item={item} rarity={rarity} />
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  color: r.starColor,
                  marginBottom: 4,
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#fff',
                  lineHeight: 1.15,
                  marginBottom: 6,
                }}
              >
                {item.name}
              </div>
              <Stars count={r.stars} color={r.starColor} />
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.4)',
                  marginTop: 8,
                  lineHeight: 1.4,
                }}
              >
                {item.description}
              </div>
            </div>
          </div>

          {/* Coin cost row */}
          {!free && !owned && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '10px 16px',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                Your coins
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>🪙</span>
                <span
                  style={{
                    fontWeight: 900,
                    fontSize: 16,
                    color: canAfford ? '#fcd34d' : '#f87171',
                  }}
                >
                  {coins.toLocaleString()}
                </span>
                {!canAfford && (
                  <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>
                    (need {(item.price - coins).toLocaleString()} more)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          {equipped ? (
            <div
              style={{
                padding: '14px',
                borderRadius: 14,
                background: `${r.border}18`,
                border: `1.5px solid ${r.border}44`,
                textAlign: 'center',
                color: r.border,
                fontWeight: 900,
                fontSize: 15,
                letterSpacing: 0.5,
              }}
            >
              ✓ CURRENTLY EQUIPPED
            </div>
          ) : owned || free ? (
            <button
              disabled={busy}
              onClick={onEquip}
              style={{
                width: '100%',
                padding: '16px',
                background: busy
                  ? 'rgba(255,255,255,0.06)'
                  : 'linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)',
                border: 'none',
                borderTop: '2px solid rgba(167,139,250,0.6)',
                borderBottom: '4px solid #2e1065',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 900,
                color: '#ede9fe',
                letterSpacing: 0.5,
                cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 20px rgba(124,58,237,0.5)',
              }}
            >
              {busy ? 'Equipping…' : 'EQUIP NOW'}
            </button>
          ) : !token ? (
            <div
              style={{
                padding: '14px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Sign in to purchase
            </div>
          ) : (
            <button
              disabled={busy || !canAfford}
              onClick={onBuy}
              style={{
                width: '100%',
                padding: '16px',
                background:
                  busy || !canAfford
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderTop: canAfford ? '2px solid #fcd34d' : '2px solid rgba(255,255,255,0.1)',
                borderBottom: canAfford ? '4px solid #78350f' : '4px solid rgba(0,0,0,0.3)',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 900,
                color: busy || !canAfford ? 'rgba(255,255,255,0.3)' : '#1c0a00',
                cursor: busy || !canAfford ? 'not-allowed' : 'pointer',
                boxShadow: canAfford ? '0 6px 22px rgba(245,158,11,0.5)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {busy ? (
                'Buying…'
              ) : (
                <>
                  <span style={{ fontSize: 20 }}>🪙</span>
                  <span>{item.price.toLocaleString()}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

const SECTION_TABS = [
  { key: 'all' as const, label: 'ALL', icon: '🏪' },
  { key: 'cardBack' as const, label: 'CARD BACKS', icon: '🃏' },
  { key: 'tableSkin' as const, label: 'TABLES', icon: '🎯' },
  { key: 'emote' as const, label: 'EMOTES', icon: '😄' },
];

const SECTION_INFO: Record<ItemType, { label: string; icon: string }> = {
  cardBack: { label: 'CARD BACKS', icon: '🃏' },
  tableSkin: { label: 'TABLE SKINS', icon: '🎯' },
  emote: { label: 'EMOTES', icon: '😄' },
};

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

  const buy = useCallback(
    async (itemId: string) => {
      if (!token) {
        showToast('Sign in to buy', false);
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
        if (!res.ok) showToast(data.error ?? 'Purchase failed', false);
        else {
          setShopState((prev) =>
            prev ? { ...prev, coins: data.coins, inventory: data.inventory } : prev,
          );
          showToast('Purchased! ✓', true);
          setSelected(null);
        }
      } finally {
        setBusy(null);
      }
    },
    [token, showToast],
  );

  const equip = useCallback(
    async (itemId: string) => {
      if (!token) {
        showToast('Sign in to equip', false);
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
        if (!res.ok) showToast(data.error ?? 'Equip failed', false);
        else {
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
    },
    [token, showToast],
  );

  const isOwned = useCallback(
    (id: string) => (shopState?.inventory ?? []).includes(id),
    [shopState],
  );
  const isEquipped = useCallback(
    (item: ShopItem) => {
      if (item.type === 'cardBack') return shopState?.equippedCardBack === item.id;
      if (item.type === 'tableSkin') return shopState?.equippedTableSkin === item.id;
      if (item.type === 'emote') return (shopState?.equippedEmotes ?? []).includes(item.id);
      return false;
    },
    [shopState],
  );

  const filtered = tab === 'all' ? items : items.filter((i) => i.type === tab);

  // Group by type for section headers (only in 'all' mode)
  const grouped: { type: ItemType; items: ShopItem[] }[] =
    tab !== 'all'
      ? []
      : (['cardBack', 'tableSkin', 'emote'] as ItemType[])
          .map((type) => ({
            type,
            items: items.filter((i) => i.type === type),
          }))
          .filter((g) => g.items.length > 0);

  return (
    <div style={{ background: '#0a0a18', minHeight: '100vh', color: 'white', paddingBottom: 100 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #12083a 0%, #0a0a18 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 16px 0',
          }}
        >
          <div style={{ lineHeight: 1 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: -0.5,
                background: 'linear-gradient(90deg, #f59e0b 0%, #fcd34d 50%, #f59e0b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: 'none',
              }}
            >
              ♦ SHOP
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.28)',
                fontWeight: 700,
                letterSpacing: 1,
                marginTop: 2,
              }}
            >
              WIN GAMES · EARN COINS · BUY ITEMS
            </div>
          </div>

          {/* Coin pill */}
          <div
            style={{
              background: 'linear-gradient(135deg, #3a1a00, #1c0a00)',
              border: '2px solid #d97706',
              borderRadius: 999,
              padding: '7px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: '0 0 16px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ fontSize: 18 }}>🪙</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#fcd34d', letterSpacing: -0.5 }}>
              {shopState ? shopState.coins.toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto' }}>
          {SECTION_TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                  border: active ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.07)',
                  background: active
                    ? 'linear-gradient(135deg, #78350f, #451a03)'
                    : 'rgba(255,255,255,0.03)',
                  color: active ? '#fcd34d' : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                  boxShadow: active ? '0 0 12px rgba(245,158,11,0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 13 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 320,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(245,158,11,0.2)',
              borderTop: '3px solid #f59e0b',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 700 }}>
            Loading shop…
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : tab === 'all' ? (
        // Grouped view
        grouped.map((group) => (
          <div key={group.type}>
            <SectionHeader
              label={SECTION_INFO[group.type].label}
              icon={SECTION_INFO[group.type].icon}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                padding: '0 12px',
              }}
            >
              {group.items.map((item) => (
                <ShopCard
                  key={item.id}
                  item={item}
                  owned={item.price === 0 || isOwned(item.id)}
                  equipped={isEquipped(item)}
                  busy={busy === item.id}
                  onBuy={() => void buy(item.id)}
                  onEquip={() => void equip(item.id)}
                  onClick={() => setSelected(item)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        // Filtered view
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            padding: '16px 12px 0',
          }}
        >
          {filtered.map((item) => (
            <ShopCard
              key={item.id}
              item={item}
              owned={item.price === 0 || isOwned(item.id)}
              equipped={isEquipped(item)}
              busy={busy === item.id}
              onBuy={() => void buy(item.id)}
              onEquip={() => void equip(item.id)}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      )}

      {/* ── Detail sheet ───────────────────────────────────────────── */}
      {selected && (
        <DetailSheet
          item={selected}
          owned={selected.price === 0 || isOwned(selected.id)}
          equipped={isEquipped(selected)}
          busy={busy === selected.id}
          coins={shopState?.coins ?? 0}
          token={token}
          onBuy={() => void buy(selected.id)}
          onEquip={() => void equip(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.ok
              ? 'linear-gradient(135deg, #065f46, #047857)'
              : 'linear-gradient(135deg, #7f1d1d, #991b1b)',
            border: `1.5px solid ${toast.ok ? '#10b981' : '#ef4444'}`,
            color: toast.ok ? '#6ee7b7' : '#fca5a5',
            padding: '11px 22px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            zIndex: 60,
            boxShadow: `0 4px 24px rgba(0,0,0,0.5)`,
            whiteSpace: 'nowrap',
            letterSpacing: 0.3,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};
