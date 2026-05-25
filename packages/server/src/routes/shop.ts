import { Router, type Request, type Response } from 'express';
import { PlayerProfile } from '../models/PlayerProfile';
import { CoinTransaction } from '../models/CoinTransaction';

export const shopRouter = Router();

interface ShopItem {
  id: string;
  name: string;
  type: 'card_back' | 'avatar_frame' | 'emote';
  price: number;
  preview: string;
}

const SHOP_CATALOG: ShopItem[] = [
  { id: 'card_back_gold', name: 'Gold Card Back', type: 'card_back', price: 500, preview: 'gold' },
  { id: 'card_back_dark', name: 'Dark Card Back', type: 'card_back', price: 300, preview: 'dark' },
  {
    id: 'card_back_ocean',
    name: 'Ocean Card Back',
    type: 'card_back',
    price: 400,
    preview: 'ocean',
  },
  {
    id: 'frame_gold',
    name: 'Gold Avatar Frame',
    type: 'avatar_frame',
    price: 750,
    preview: 'gold',
  },
  {
    id: 'frame_diamond',
    name: 'Diamond Frame',
    type: 'avatar_frame',
    price: 1500,
    preview: 'diamond',
  },
  { id: 'emote_laugh', name: 'Laugh Emote', type: 'emote', price: 200, preview: '😂' },
  { id: 'emote_gg', name: 'GG Emote', type: 'emote', price: 200, preview: '🤝' },
  { id: 'emote_fire', name: 'Fire Emote', type: 'emote', price: 250, preview: '🔥' },
];

const ITEM_MAP = new Map<string, ShopItem>(SHOP_CATALOG.map((item) => [item.id, item]));

shopRouter.get('/items', (_req: Request, res: Response) => {
  res.json(SHOP_CATALOG);
});

shopRouter.post('/purchase', async (req: Request, res: Response) => {
  const { discordId, userId, itemId } = req.body as {
    discordId?: string;
    userId?: string;
    itemId?: string;
  };

  if (!itemId) {
    res.status(400).json({ error: 'itemId is required' });
    return;
  }

  if (!discordId && !userId) {
    res.status(400).json({ error: 'discordId or userId is required' });
    return;
  }

  const item = ITEM_MAP.get(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const query = discordId ? { discordId } : { userId };
  const profile = await PlayerProfile.findOne(query);
  if (!profile) {
    res.status(404).json({ error: 'Player profile not found' });
    return;
  }

  if (profile.ownedItems.includes(itemId)) {
    res.status(400).json({ error: 'Item already owned' });
    return;
  }

  if (profile.coins < item.price) {
    res.status(400).json({ error: 'Insufficient coins' });
    return;
  }

  const [updated] = await Promise.all([
    PlayerProfile.findByIdAndUpdate(
      profile._id,
      {
        $inc: { coins: -item.price },
        $push: { ownedItems: itemId },
      },
      { new: true },
    ),
    CoinTransaction.create({
      playerId: profile._id,
      amount: -item.price,
      reason: 'purchase',
      metadata: { itemId },
    }),
  ]);

  res.json({
    ok: true,
    balance: updated?.coins ?? profile.coins - item.price,
    ownedItems: updated?.ownedItems ?? [...profile.ownedItems, itemId],
  });
});
