import { Router } from 'express';
import { PlayerProfile } from '../models/PlayerProfile';
import type { AuthHelpers } from './authHelpers';

const DEFAULT_SETTINGS = {
  soundEffects: true,
  animations: true,
  showTimer: true,
  confirmLeave: true,
  language: 'en',
};

export function createSettingsRouter({ profileFromToken }: AuthHelpers): Router {
  const router = Router();

  router.get('/settings', async (req, res) => {
    const profile = await profileFromToken(req.headers.authorization);
    if (!profile) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ ...DEFAULT_SETTINGS, ...(profile.settings ?? {}) });
  });

  router.patch('/settings', async (req, res) => {
    const profile = await profileFromToken(req.headers.authorization);
    if (!profile) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const boolFields = ['soundEffects', 'animations', 'showTimer', 'confirmLeave'] as const;
    const update: Record<string, boolean | string> = {};
    for (const key of boolFields) {
      if (typeof req.body[key] === 'boolean') update[`settings.${key}`] = req.body[key];
    }
    if (typeof req.body.language === 'string' && ['en', 'mn'].includes(req.body.language)) {
      update['settings.language'] = req.body.language;
    }
    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: 'No valid fields provided' });
      return;
    }
    await PlayerProfile.updateOne({ _id: profile._id }, { $set: update });
    const fresh = await profileFromToken(req.headers.authorization);
    res.json({ ...DEFAULT_SETTINGS, ...(fresh?.settings ?? {}) });
  });

  return router;
}
