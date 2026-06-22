import { RARITY } from './types';
import type { Rarity, ShopItem } from './types';

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

export function ShopStyles() {
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

export function ItemArt({ item, rarity }: { item: ShopItem; rarity: Rarity }) {
  if (item.image) {
    if (item.type === 'cardBack') return <CardImageArt src={item.image} rarity={rarity} />;
    if (item.type === 'emote') return <EmoteImageArt src={item.image} rarity={rarity} />;
  }
  const isEmoji = !/^#/.test(item.preview);
  if (isEmoji) return <EmoteArt emoji={item.preview} rarity={rarity} />;
  if (item.type === 'cardBack') return <CardArt color={item.preview} rarity={rarity} />;
  return <TableArt color={item.preview} rarity={rarity} />;
}

export function Stars({ count, color }: { count: number; color: string }) {
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
