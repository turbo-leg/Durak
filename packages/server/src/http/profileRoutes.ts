import { Router } from 'express';
import { PlayerProfile } from '../models/PlayerProfile';
import { GameLog } from '../models/GameLog';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Server error');

export function createProfileRouter(): Router {
  const router = Router();

  // Accepts ?by=discord (default) or ?by=user
  router.get('/profile/:id', async (req, res) => {
    try {
      const by = req.query.by === 'user' ? 'userId' : 'discordId';
      const profile = await PlayerProfile.findOne({ [by]: req.params.id }).lean();
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      res.json(profile);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  router.get('/leaderboard', async (req, res) => {
    try {
      const mode = req.query.mode === 'teams' ? 'eloTeams' : 'eloClassic';
      const rawLimit = parseInt(String(req.query.limit ?? '10'), 10);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 50)) : 10;
      const leaders = await PlayerProfile.find({ 'stats.gamesPlayed': { $gte: 1 } })
        .sort({ [mode]: -1 })
        .limit(limit)
        .select('username avatarUrl eloClassic eloTeams stats.gamesPlayed premium.active')
        .lean();
      res.json(leaders);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  router.get('/history/:id', async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
      const by = req.query.by === 'user' ? 'userIds' : 'discordIds';
      const logs = await GameLog.find({ [by]: req.params.id })
        .sort({ date: -1 })
        .limit(limit)
        .select('-actionLog')
        .lean();
      res.json(logs);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  return router;
}
