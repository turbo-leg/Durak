import React from 'react';
import { useTranslation } from 'react-i18next';
import { RARITY, rarityFor } from './types';
import type { ShopItem } from './types';
import { ItemArt, Stars } from './art';

export function ShopCard({
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
  const { t } = useTranslation('shop');
  const rarity = rarityFor(item.price);
  const r = RARITY[rarity];
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
            {t('button.on')}
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
            {t('button.hot')}
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
        {item.premiumOnly && !owned ? (
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(106,13,173,0.15), rgba(106,13,173,0.08))',
              border: '1px solid rgba(106,13,173,0.5)',
              borderRadius: 10,
              padding: '8px 0',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 900,
              color: '#c084fc',
              letterSpacing: 1.2,
            }}
          >
            {t('button.premium')}
          </div>
        ) : equipped ? (
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
            {t('button.equipped')}
          </div>
        ) : owned ? (
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
            {busy ? '…' : t('button.equip')}
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

export function SectionHeader({ label, icon }: { label: string; icon: string }) {
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
