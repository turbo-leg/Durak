import { Router } from 'express';
import { PlayerProfile } from '../models/PlayerProfile';
import { SHOP_ITEMS, FREE_ITEM_IDS, PREMIUM_ITEM_IDS } from '../config/shopCatalog';
import type { AuthHelpers } from './authHelpers';

export function createShopRouter({
  userIdFromToken,
  discordIdFromToken,
  profileFromToken,
}: AuthHelpers): Router {
  const router = Router();

  router.get('/shop/items', (_req, res) => {
    res.json(SHOP_ITEMS);
  });

  router.get('/shop/me', async (req, res) => {
    const profile = await profileFromToken(req.headers.authorization);
    if (
      profile === null &&
      !userIdFromToken(req.headers.authorization) &&
      !discordIdFromToken(req.headers.authorization)
    ) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({
      coins: profile?.coins ?? 0,
      inventory: profile?.inventory ?? [],
      equippedCardBack: profile?.equippedCardBack ?? '',
      equippedTableSkin: profile?.equippedTableSkin ?? '',
      equippedEmotes: profile?.equippedEmotes ?? [],
      isPremium: profile?.premium?.active ?? false,
    });
  });

  router.post('/shop/buy', async (req, res) => {
    const profile = await profileFromToken(req.headers.authorization);
    if (!profile) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { itemId } = req.body as { itemId?: string };
    if (!itemId) {
      res.status(400).json({ error: 'Missing itemId' });
      return;
    }
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    if (PREMIUM_ITEM_IDS.has(itemId)) {
      res.status(403).json({ error: 'Premium membership required' });
      return;
    }
    if (profile.inventory?.includes(itemId) || FREE_ITEM_IDS.has(itemId)) {
      res.status(400).json({ error: 'Already owned' });
      return;
    }
    if ((profile.coins ?? 0) < item.price) {
      res.status(402).json({ error: 'Not enough coins' });
      return;
    }
    profile.coins = (profile.coins ?? 0) - item.price;
    profile.inventory = [...(profile.inventory ?? []), itemId];
    await profile.save();
    res.json({ coins: profile.coins, inventory: profile.inventory });
  });

  router.post('/shop/equip', async (req, res) => {
    const profile = await profileFromToken(req.headers.authorization);
    if (!profile) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { itemId } = req.body as { itemId?: string };
    if (!itemId) {
      res.status(400).json({ error: 'Missing itemId' });
      return;
    }
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    const isPremium = profile.premium?.active ?? false;
    const isPremiumItem = PREMIUM_ITEM_IDS.has(itemId);
    if (isPremiumItem && !isPremium) {
      res.status(403).json({ error: 'Premium membership required' });
      return;
    }
    const owned =
      isPremiumItem || FREE_ITEM_IDS.has(itemId) || (profile.inventory ?? []).includes(itemId);
    if (!owned) {
      res.status(403).json({ error: 'Item not owned' });
      return;
    }
    if (item.type === 'cardBack') profile.equippedCardBack = itemId;
    else if (item.type === 'tableSkin') profile.equippedTableSkin = itemId;
    else if (item.type === 'emote') {
      const emotes = new Set(profile.equippedEmotes ?? []);
      emotes.has(itemId) ? emotes.delete(itemId) : emotes.add(itemId);
      profile.equippedEmotes = [...emotes];
    }
    await profile.save();
    res.json({
      equippedCardBack: profile.equippedCardBack,
      equippedTableSkin: profile.equippedTableSkin,
      equippedEmotes: profile.equippedEmotes,
    });
  });

  // ── Premium Admin ──────────────────────────────────────────────────────────
  router.post('/admin/grant-premium', async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || req.headers.authorization !== `Bearer ${adminSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const {
      id,
      by,
      source = 'admin',
    } = req.body as {
      id?: string;
      by?: 'discord' | 'user';
      source?: string;
    };
    if (!id || !by) {
      res.status(400).json({ error: 'id and by (discord|user) required' });
      return;
    }
    const filter = by === 'discord' ? { discordId: id } : { userId: id };
    const updated = await PlayerProfile.findOneAndUpdate(
      filter,
      {
        $set: {
          'premium.active': true,
          'premium.grantedAt': new Date(),
          'premium.source': source,
        },
      },
      { new: true, upsert: false },
    );
    if (!updated) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ ok: true, premium: updated.premium });
  });

  return router;
}
