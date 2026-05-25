import { Router } from 'express';
import { PlayerProfile } from '../models/PlayerProfile';
import { CoinTransaction } from '../models/CoinTransaction';
import { awardCoins, COIN_REWARDS } from '../utils/coins';
import mongoose from 'mongoose';

export const iapRouter = Router();

const COIN_PACK_AMOUNTS: Record<string, number> = {
  coins_small: 500,
  coins_medium: 1200,
  coins_large: 3000,
  coins_mega: 7500,
};

// RevenueCat webhook — called server-to-server on successful purchase
// See: https://www.revenuecat.com/docs/integrations/webhooks
iapRouter.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    // Only process INITIAL_PURCHASE and NON_RENEWING_PURCHASE events
    if (!['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE'].includes(event.type)) {
      res.json({ ok: true });
      return;
    }

    const productId: string = event.product_id ?? '';
    const coins = COIN_PACK_AMOUNTS[productId];
    if (!coins) {
      res.status(400).json({ error: 'Unknown product' });
      return;
    }

    // RevenueCat passes app_user_id which we set to the player's profile _id
    const profileId = event.app_user_id as string;
    const purchaseId: string = event.id ?? '';

    // Idempotency: skip if already processed
    const existing = await CoinTransaction.findOne({ 'metadata.purchaseId': purchaseId });
    if (existing) {
      res.json({ ok: true, duplicate: true });
      return;
    }

    const profile = await PlayerProfile.findById(profileId);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    await awardCoins(profile._id as mongoose.Types.ObjectId, coins, 'iap', {
      productId,
      purchaseId,
      platform: event.store,
    });

    res.json({ ok: true, coins });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Client-side validation fallback (belt-and-suspenders; primary path is webhook)
iapRouter.post('/validate', async (req, res) => {
  try {
    const { productId, customerInfo, discordId, userId } = req.body as {
      productId: string;
      customerInfo: Record<string, unknown>;
      discordId?: string;
      userId?: string;
    };

    const coins = COIN_PACK_AMOUNTS[productId];
    if (!coins) {
      res.status(400).json({ error: 'Unknown product' });
      return;
    }

    // Use the entitlement ID as the idempotency key
    const purchaseId = String((customerInfo as any)?.originalPurchaseDate ?? Date.now());

    const existing = await CoinTransaction.findOne({
      'metadata.purchaseId': purchaseId,
      reason: 'iap',
    });
    if (existing) {
      res.json({ ok: true, duplicate: true });
      return;
    }

    const filter = discordId ? { discordId } : { userId };
    const profile = await PlayerProfile.findOne(filter);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    await awardCoins(profile._id as mongoose.Types.ObjectId, coins, 'iap', {
      productId,
      purchaseId,
    });
    res.json({ ok: true, coins, balance: (profile.coins ?? 0) + coins });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
