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
  image?: string;
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
    cardGradient: 'linear-gradient(175deg, #f5ead0 0%, #ebe0c4 55%, #d8c89c 100%)', // Parchment
    border: 'rgba(212,175,55,0.5)', // Gold outline
    topBar: 'linear-gradient(90deg, #ebe0c4, #faf3dd, #ebe0c4)',
    glow: 'rgba(212,175,55,0.2)',
    label: 'COMMON',
    stars: 1,
    starColor: '#d4af37',
  },
  rare: {
    cardGradient: 'linear-gradient(175deg, #135c3f 0%, #0a3624 55%, #04150e 100%)', // Felt Green
    border: '#e6c258', // Light Gold
    topBar: 'linear-gradient(90deg, #0a3624, #135c3f, #0a3624)',
    glow: 'rgba(230,194,88,0.3)',
    label: 'RARE',
    stars: 2,
    starColor: '#e6c258',
  },
  epic: {
    cardGradient: 'linear-gradient(175deg, #8b2121 0%, #5b1818 55%, #2a0a0a 100%)', // Velvet Burgundy
    border: '#f4d774', // Soft Gold
    topBar: 'linear-gradient(90deg, #5b1818, #8b2121, #5b1818)',
    glow: 'rgba(244,215,116,0.4)',
    label: 'EPIC',
    stars: 3,
    starColor: '#f4d774',
  },
  legendary: {
    cardGradient: 'linear-gradient(175deg, #d4af37 0%, #b8902a 55%, #4a3608 100%)', // Pure Gold
    border: '#f4d774',
    topBar: 'linear-gradient(90deg, #b8902a, #f4d774, #b8902a)',
    glow: 'rgba(212,175,55,0.6)',
    label: 'LEGENDARY',
    stars: 3,
    starColor: '#fcd34d',
  },
};

// ── Global CSS injected once ──────────────────────────────────────────────

const SHOP_CSS = `
  @keyframes shopCardIn {
    from { opacity: 0; transform: translateY(24px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes shopShimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes shopGlowPulse {
    0%,100% { opacity: 1; filter: drop-shadow(0 0 4px rgba(212,175,55,0.5)); }
    50%     { opacity: 0.7; filter: drop-shadow(0 0 1px rgba(212,175,55,0.1)); }
  }
  .shop-card { 
    transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, border-color 0.2s ease;
    background: linear-gradient(180deg, rgba(10,54,36,0.65) 0%, rgba(7,38,26,0.85) 100%);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .shop-card:active { transform: scale(0.97) !important; }
  .shop-card:hover  { transform: translateY(-4px); border-color: rgba(212,175,55,0.55) !important; }
  .shop-btn {
    transition: transform 0.1s ease, filter 0.1s ease, box-shadow 0.1s ease;
  }
  .shop-btn:active  { transform: scale(0.96) !important; filter: brightness(0.9); }
`;

function ShopStyles() {
  return <style dangerouslySetInnerHTML={{ __html: SHOP_CSS }} />;
}

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

function CardImageArt({ src, rarity }: { src: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div
      style={{
        position: 'relative',
        width: 68,
        height: 92,
        borderRadius: 9,
        overflow: 'hidden',
        boxShadow: `0 8px 24px rgba(0,0,0,0.7), 0 0 18px ${r.glow}`,
        border: `2px solid ${r.border}`,
      }}
    >
      <img
        src={`/assets/${src}`}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '42%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 100%)',
          borderRadius: '9px 9px 0 0',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function EmoteImageArt({ src, rarity }: { src: string; rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <div
      style={{
        position: 'relative',
        width: 80,
        height: 80,
        borderRadius: '50%',
        overflow: 'hidden',
        boxShadow: `0 8px 24px rgba(0,0,0,0.7), 0 0 18px ${r.glow}`,
        border: `2px solid ${r.border}`,
      }}
    >
      <img
        src={`/assets/${src}`}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '42%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
          borderRadius: '50% 50% 0 0 / 30% 30% 0 0',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function ItemArt({ item, rarity }: { item: ShopItem; rarity: Rarity }) {
  if (item.image) {
    if (item.type === 'cardBack') return <CardImageArt src={item.image} rarity={rarity} />;
    if (item.type === 'emote') return <EmoteImageArt src={item.image} rarity={rarity} />;
  }
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
  index,
  onBuy,
  onEquip,
  onClick,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  busy: boolean;
  index: number;
  onBuy: () => void;
  onEquip: () => void;
  onClick: () => void;
}) {
  const rarity = rarityFor(item.price);
  const r = RARITY[rarity];
  const free = item.price === 0;
  const isLegendary = rarity === 'legendary';
  const isEpic = rarity === 'epic';

  // Shimmer top bar for epic/legendary
  const topBarStyle: React.CSSProperties = isLegendary
    ? {
        height: 5,
        background: 'linear-gradient(90deg, #b8902a, #f4d774, #fff7, #f4d774, #b8902a)',
        backgroundSize: '200% auto',
        animation: 'shopShimmer 2s linear infinite',
      }
    : isEpic
      ? {
          height: 5,
          background: 'linear-gradient(90deg, #5b1818, #8b2121, #fff4, #8b2121, #5b1818)',
          backgroundSize: '200% auto',
          animation: 'shopShimmer 2.5s linear infinite',
        }
      : { height: 5, background: r.topBar };

  return (
    <div
      className="shop-card"
      onClick={onClick}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${equipped ? r.border : 'rgba(212,175,55,0.18)'}`,
        boxShadow: equipped
          ? `0 0 22px ${r.glow}, 0 6px 20px rgba(0,0,0,0.6)`
          : `0 6px 20px rgba(0,0,0,0.5)`,
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        animation: `shopCardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both`,
        animationDelay: `${index * 55}ms`,
      }}
    >
      {/* Rarity top bar */}
      <div style={topBarStyle} />

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
              background: 'var(--gradient-gold)',
              color: 'var(--ink-900)',
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.8,
              padding: '2px 7px',
              borderRadius: 999,
              boxShadow: `0 2px 8px ${r.glow}`,
              animation: 'shopGlowPulse 1.8s ease-in-out infinite',
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
              background: 'linear-gradient(135deg, #8b2121, #2a0a0a)',
              border: '1px solid rgba(212,175,55,0.3)',
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
          background: 'linear-gradient(180deg, rgba(7,38,26,0.95) 0%, rgba(4,21,14,0.98) 100%)',
          padding: '10px 10px 12px',
          borderTop: '1px solid rgba(212,175,55,0.18)',
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
              color: 'var(--ivory-100)',
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
              background: `linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.03) 100%)`,
              border: `1px solid rgba(212,175,55,0.35)`,
              borderRadius: 10,
              padding: '8px 0',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 900,
              color: 'var(--gold-400)',
              letterSpacing: 1.2,
            }}
          >
            ✓ EQUIPPED
          </div>
        ) : owned || free ? (
          <button
            className="shop-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEquip();
            }}
            disabled={busy}
            style={{
              width: '100%',
              background: busy
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(180deg, #135c3f 0%, #0a3624 100%)',
              border: 'none',
              borderTop: '2px solid rgba(212,175,55,0.4)',
              borderBottom: '3px solid #04150e',
              borderRadius: 10,
              padding: '8px 0',
              fontSize: 11,
              fontWeight: 900,
              color: 'var(--ivory-50)',
              letterSpacing: 1.2,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(19,92,63,0.4)',
              transition: 'filter 0.1s',
            }}
          >
            {busy ? '…' : free ? '+ EQUIP FREE' : 'EQUIP'}
          </button>
        ) : (
          <button
            className="shop-btn"
            onClick={(e) => {
              e.stopPropagation();
              onBuy();
            }}
            disabled={busy}
            style={{
              width: '100%',
              background: busy
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(180deg, var(--gold-300) 0%, var(--gold-500) 100%)',
              border: 'none',
              borderTop: '2px solid var(--gold-300)',
              borderBottom: '3px solid var(--gold-700)',
              borderRadius: 10,
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 900,
              color: 'var(--ink-900)',
              letterSpacing: 1.2,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(212,175,55,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              transition: 'filter 0.1s',
            }}
          >
            {busy ? (
              '…'
            ) : (
              <>
                <img
                  src="/assets/coin.png"
                  alt="coins"
                  style={{ width: 14, height: 14, objectFit: 'contain', display: 'inline-block' }}
                />
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 12px 12px' }}>
      <div
        style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.22))',
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
          color: 'var(--gold-400)',
          fontFamily: 'var(--font-display)',
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div
        style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, rgba(212,175,55,0.22), transparent)',
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
        background: 'rgba(4,21,14,0.85)',
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
          background: 'linear-gradient(180deg, #07261a 0%, #04150e 100%)',
          border: `2px solid var(--gold-500)`,
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
              background: 'rgba(212,175,55,0.25)',
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
                  fontFamily: 'var(--font-display)',
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--ivory-50)',
                  lineHeight: 1.15,
                  marginBottom: 6,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {item.name}
              </div>
              <Stars count={r.stars} color={r.starColor} />
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ivory-200)',
                  marginTop: 8,
                  lineHeight: 1.4,
                  opacity: 0.85,
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
                background: 'rgba(212,175,55,0.06)',
                border: '1px solid rgba(212,175,55,0.18)',
                borderRadius: 12,
                padding: '10px 16px',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--ivory-200)', fontWeight: 700 }}>
                Your coins
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <img
                  src="/assets/coin.png"
                  alt="coins"
                  style={{ width: 16, height: 16, objectFit: 'contain', display: 'inline-block' }}
                />
                <span
                  style={{
                    fontWeight: 900,
                    fontSize: 16,
                    color: canAfford ? 'var(--gold-300)' : '#f87171',
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
                background: `rgba(212,175,55,0.08)`,
                border: `1.5px solid rgba(212,175,55,0.35)`,
                textAlign: 'center',
                color: 'var(--gold-400)',
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 1.5,
              }}
            >
              ✓ CURRENTLY EQUIPPED
            </div>
          ) : owned || free ? (
            <button
              className="shop-btn"
              disabled={busy}
              onClick={onEquip}
              style={{
                width: '100%',
                padding: '16px',
                background: busy
                  ? 'rgba(255,255,255,0.06)'
                  : 'linear-gradient(180deg, #135c3f 0%, #0a3624 100%)',
                border: 'none',
                borderTop: '2px solid rgba(212,175,55,0.4)',
                borderBottom: '4px solid #04150e',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 900,
                color: 'var(--ivory-50)',
                letterSpacing: 1.5,
                cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 20px rgba(19,92,63,0.5)',
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
                color: 'var(--ivory-300)',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Sign in to purchase
            </div>
          ) : (
            <button
              className="shop-btn"
              disabled={busy || !canAfford}
              onClick={onBuy}
              style={{
                width: '100%',
                padding: '16px',
                background:
                  busy || !canAfford
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(180deg, var(--gold-300) 0%, var(--gold-500) 100%)',
                border: 'none',
                borderTop: canAfford
                  ? '2px solid var(--gold-300)'
                  : '2px solid rgba(255,255,255,0.1)',
                borderBottom: canAfford ? '4px solid var(--gold-700)' : '4px solid rgba(0,0,0,0.3)',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 900,
                color: busy || !canAfford ? 'rgba(255,255,255,0.3)' : 'var(--ink-900)',
                cursor: busy || !canAfford ? 'not-allowed' : 'pointer',
                boxShadow: canAfford ? '0 6px 22px rgba(212,175,55,0.5)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                letterSpacing: 1.5,
              }}
            >
              {busy ? (
                'Buying…'
              ) : (
                <>
                  <img
                    src="/assets/coin.png"
                    alt="coins"
                    style={{ width: 20, height: 20, objectFit: 'contain', display: 'inline-block' }}
                  />
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
  const [showEarnInfo, setShowEarnInfo] = useState(false);

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
    <div
      style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: 100 }}
    >
      <ShopStyles />
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #07261a 0%, rgba(4,21,14,0.85) 100%)',
          borderBottom: '1px solid rgba(212,175,55,0.22)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
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
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: 2,
                fontFamily: 'var(--font-display)',
                background: 'var(--gradient-gold)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              ♦ SHOP
            </div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--ivory-300)',
                fontWeight: 700,
                letterSpacing: 1.5,
                marginTop: 4,
                opacity: 0.7,
              }}
            >
              WIN GAMES · EARN COINS · BUY ITEMS
            </div>
          </div>

          {/* Coin pill + earn button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #3a1a00, #1c0a00)',
                border: '2px solid var(--gold-500)',
                borderRadius: 999,
                padding: '7px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 0 16px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              <img
                src="/assets/coin.png"
                alt="coins"
                style={{ width: 20, height: 20, objectFit: 'contain', display: 'inline-block' }}
              />
              <span
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  color: 'var(--gold-300)',
                  letterSpacing: -0.5,
                }}
              >
                {(shopState?.coins ?? 0).toLocaleString()}
              </span>
            </div>
            <button
              className="shop-btn"
              onClick={() => setShowEarnInfo((v) => !v)}
              style={{
                background: 'linear-gradient(180deg, #135c3f 0%, #0a3624 100%)',
                border: '1.5px solid var(--gold-500)',
                borderRadius: 999,
                padding: '8px 14px',
                color: 'var(--gold-300)',
                fontWeight: 900,
                fontSize: 11,
                cursor: 'pointer',
                letterSpacing: 1,
                boxShadow: '0 0 12px rgba(19,92,63,0.3)',
                fontFamily: 'var(--font-display)',
              }}
            >
              + Get Coins
            </button>
            {showEarnInfo && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  background: 'linear-gradient(180deg, #07261a 0%, #04150e 100%)',
                  border: '1.5px solid var(--gold-500)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  zIndex: 100,
                  minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 11,
                    color: 'var(--gold-400)',
                    marginBottom: 8,
                    letterSpacing: 0.8,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  HOW TO EARN COINS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Win a game', reward: '+10' },
                    { label: 'Finish (not durak)', reward: '+5' },
                    { label: 'Be the durak', reward: '+3' },
                  ].map(({ label, reward }) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--ivory-200)' }}>{label}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: 'var(--gold-300)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{reward}</span>
                        <img
                          src="/assets/coin.png"
                          alt="coins"
                          style={{ width: 12, height: 12, objectFit: 'contain' }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto' }}>
          {SECTION_TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                className="shop-btn"
                onClick={() => setTab(t.key)}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  border: active
                    ? '1.5px solid var(--gold-400)'
                    : '1.5px solid rgba(212,175,55,0.18)',
                  background: active
                    ? 'linear-gradient(180deg, #0a3624 0%, #04150e 100%)'
                    : 'rgba(255,255,255,0.03)',
                  color: active ? 'var(--gold-300)' : 'var(--ivory-300)',
                  cursor: 'pointer',
                  boxShadow: active ? '0 0 12px rgba(212,175,55,0.22)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'var(--font-display)',
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
              border: '3px solid rgba(212,175,55,0.2)',
              borderTop: '3px solid var(--gold-500)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ color: 'var(--ivory-300)', fontSize: 13, fontWeight: 700 }}>
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
              {group.items.map((item, i) => (
                <ShopCard
                  key={item.id}
                  index={i}
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
          {filtered.map((item, i) => (
            <ShopCard
              key={item.id}
              index={i}
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
              ? 'linear-gradient(135deg, #0a3624, #04150e)'
              : 'linear-gradient(135deg, #8b2121, #2a0a0a)',
            border: `1.5px solid ${toast.ok ? 'var(--gold-400)' : '#ef4444'}`,
            color: toast.ok ? 'var(--ivory-50)' : '#fca5a5',
            padding: '11px 22px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            zIndex: 60,
            boxShadow: `0 4px 24px rgba(0,0,0,0.55)`,
            whiteSpace: 'nowrap',
            letterSpacing: 0.5,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};
