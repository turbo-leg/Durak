import { useTranslation } from 'react-i18next';
import { RARITY, rarityFor } from './types';
import type { ShopItem } from './types';
import { ItemArt, Stars } from './art';

export function DetailSheet({
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
  const { t } = useTranslation('shop');
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
                {t(`rarity.${rarity}`)}
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
                {t('yourCoins')}
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
                    {t('button.needMore', { count: item.price - coins })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          {item.premiumOnly && !owned ? (
            <div
              style={{
                padding: '14px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(106,13,173,0.2), rgba(106,13,173,0.1))',
                border: '1.5px solid rgba(106,13,173,0.5)',
                textAlign: 'center',
                color: '#c084fc',
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 1.5,
              }}
            >
              {t('button.premiumMembersOnly')}
            </div>
          ) : equipped ? (
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
              {t('button.currentlyEquipped')}
            </div>
          ) : owned ? (
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
              {busy ? t('button.equipping') : t('button.equipNow')}
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
              {t('button.signInBuy')}
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
                t('button.buying')
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
