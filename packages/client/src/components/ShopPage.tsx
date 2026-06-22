import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { API } from './shop/types';
import type { ItemType, ShopItem, ShopState } from './shop/types';
import { ShopStyles } from './shop/art';
import { ShopCard, SectionHeader } from './shop/ShopCard';
import { DetailSheet } from './shop/DetailSheet';

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
  const { t } = useTranslation('shop');
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
        showToast(t('toast.signInBuy'), false);
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
        if (!res.ok) showToast(data.error ?? t('toast.purchaseFailed'), false);
        else {
          setShopState((prev) =>
            prev ? { ...prev, coins: data.coins, inventory: data.inventory } : prev,
          );
          showToast(t('toast.purchased'), true);
          setSelected(null);
        }
      } finally {
        setBusy(null);
      }
    },
    [token, showToast, t],
  );

  const equip = useCallback(
    async (itemId: string) => {
      if (!token) {
        showToast(t('toast.signInEquip'), false);
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
        if (!res.ok) showToast(data.error ?? t('toast.equipFailed'), false);
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
          showToast(t('toast.purchased'), true);
          setSelected(null);
        }
      } finally {
        setBusy(null);
      }
    },
    [token, showToast, t],
  );

  const isPremium = shopState?.isPremium ?? false;
  const isOwned = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item?.premiumOnly) return isPremium;
      if (item?.price === 0) return true;
      return (shopState?.inventory ?? []).includes(id);
    },
    [shopState, isPremium, items],
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
      style={{
        background: 'transparent',
        minHeight: '100dvh',
        color: 'white',
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
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
            gap: 10,
            padding: '13px 14px 0',
          }}
        >
          <div style={{ lineHeight: 1, minWidth: 0, flex: '1 1 auto' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 1,
                fontFamily: 'var(--font-display)',
                background: 'var(--gradient-gold)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              {t('title')}
            </div>
            <div
              style={{
                fontSize: 8,
                color: 'var(--ivory-300)',
                fontWeight: 700,
                letterSpacing: 1,
                marginTop: 3,
                opacity: 0.65,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {t('subtitle')}
            </div>
          </div>

          {/* Coin pill + earn button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #3a1a00, #1c0a00)',
                border: '1.5px solid var(--gold-500)',
                borderRadius: 999,
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 0 12px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              <img
                src="/assets/coin.png"
                alt="coins"
                style={{ width: 16, height: 16, objectFit: 'contain', display: 'inline-block' }}
              />
              <span
                style={{
                  fontWeight: 900,
                  fontSize: 15,
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
                padding: '6px 11px',
                color: 'var(--gold-300)',
                fontWeight: 900,
                fontSize: 10,
                cursor: 'pointer',
                letterSpacing: 0.5,
                lineHeight: 1.15,
                maxWidth: 84,
                boxShadow: '0 0 12px rgba(19,92,63,0.3)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {t('getCoins')}
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
                  {t('howToEarn')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: t('earnWin'), reward: t('earnWinCoins') },
                    { label: t('earnFinish'), reward: t('earnFinishCoins') },
                    { label: t('earnDurak'), reward: t('earnDurakCoins') },
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
          {SECTION_TABS.map((tabItem) => {
            const active = tab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                className="shop-btn"
                onClick={() => setTab(tabItem.key)}
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
                <span style={{ fontSize: 13 }}>{tabItem.icon}</span>
                <span>
                  {t(
                    `tabs.${tabItem.key === 'all' ? 'all' : tabItem.key === 'cardBack' ? 'cardBacks' : tabItem.key === 'tableSkin' ? 'tables' : 'emotes'}`,
                  )}
                </span>
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
            {t('loading')}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : tab === 'all' ? (
        // Grouped view
        grouped.map((group) => (
          <div key={group.type}>
            <SectionHeader
              label={t(
                `sections.${group.type === 'cardBack' ? 'cardBacks' : group.type === 'tableSkin' ? 'tableSkins' : 'emotes'}`,
              )}
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
                  owned={isOwned(item.id)}
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
              owned={isOwned(item.id)}
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
          owned={isOwned(selected.id)}
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
