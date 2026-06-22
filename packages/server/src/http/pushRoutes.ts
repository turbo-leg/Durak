import { Router } from 'express';
import { PlayerProfile } from '../models/PlayerProfile';
import type { AuthHelpers } from './authHelpers';

const MAX_TOKENS_PER_PROFILE = 5;

export function createPushRouter({ profileFromToken }: AuthHelpers): Router {
  const router = Router();

  router.post('/push/register', async (req, res) => {
    const profile = await profileFromToken(req.headers.authorization);
    if (!profile) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== 'string' || token.length > 512) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }
    const tokens = profile.deviceTokens ?? [];
    if (!tokens.includes(token)) {
      // Keep at most MAX_TOKENS_PER_PROFILE — drop oldest when full
      const next =
        tokens.length >= MAX_TOKENS_PER_PROFILE
          ? [...tokens.slice(-(MAX_TOKENS_PER_PROFILE - 1)), token]
          : [...tokens, token];
      await PlayerProfile.updateOne({ _id: profile._id }, { $set: { deviceTokens: next } });
    }
    res.json({ ok: true });
  });

  router.delete('/push/unregister', async (req, res) => {
    const profile = await profileFromToken(req.headers.authorization);
    if (!profile) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: 'Missing token' });
      return;
    }
    await PlayerProfile.updateOne({ _id: profile._id }, { $pull: { deviceTokens: token } });
    res.json({ ok: true });
  });

  return router;
}
