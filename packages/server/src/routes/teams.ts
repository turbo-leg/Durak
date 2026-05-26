import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PlayerProfile, IPlayerProfile } from '../models/PlayerProfile';
import { Team } from '../models/Team';

const router = Router();

interface AuthRequest extends Request {
  profile?: IPlayerProfile;
}

async function requireProfile(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || '') as {
      userId: string;
    };
    const profile = await PlayerProfile.findOne({ userId: payload.userId });
    if (!profile) {
      res.status(401).json({ error: 'Profile not found' });
      return;
    }
    req.profile = profile;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/teams — create a new team
router.post('/', requireProfile, async (req: AuthRequest, res: Response) => {
  const { name, tag } = req.body as { name?: string; tag?: string };
  if (!name || !tag) {
    res.status(400).json({ error: 'name and tag are required' });
    return;
  }
  const profileId = req.profile!._id.toString();
  try {
    const existing = await Team.findOne({ ownerId: profileId });
    if (existing) {
      res.status(409).json({ error: 'You already own a team' });
      return;
    }
    const team = await Team.create({
      name: name.trim(),
      tag: tag.trim().toUpperCase(),
      ownerId: profileId,
      members: [{ profileId, role: 'owner', joinedAt: new Date() }],
    });
    res.status(201).json(team);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create team';
    res.status(400).json({ error: msg });
  }
});

// GET /api/teams/:id — get team details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    const memberIds = team.members.map((m) => m.profileId);
    const profiles = await PlayerProfile.find({ _id: { $in: memberIds } }).select(
      '_id username avatarUrl eloTeams',
    );
    const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));
    const members = team.members.map((m) => ({
      profileId: m.profileId,
      role: m.role,
      joinedAt: m.joinedAt,
      profile: profileMap.get(m.profileId),
    }));
    res.json({ ...team.toObject(), members });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/teams/mine — get the caller's team (JWT required)
router.get('/mine', requireProfile, async (req: AuthRequest, res: Response) => {
  const profileId = req.profile!._id.toString();
  try {
    const team = await Team.findOne({ 'members.profileId': profileId });
    if (!team) {
      res.status(404).json({ error: 'Not in a team' });
      return;
    }
    const memberIds = team.members.map((m) => m.profileId);
    const profiles = await PlayerProfile.find({ _id: { $in: memberIds } }).select(
      '_id username avatarUrl eloTeams',
    );
    const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));
    const members = team.members.map((m) => ({
      profileId: m.profileId,
      role: m.role,
      joinedAt: m.joinedAt,
      ...(profileMap.get(m.profileId)
        ? {
            username: profileMap.get(m.profileId)!.username,
            avatarUrl: profileMap.get(m.profileId)!.avatarUrl,
            eloTeams: profileMap.get(m.profileId)!.eloTeams,
          }
        : {}),
    }));
    res.json({ ...team.toObject(), members });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/teams — leaderboard (top 50 by eloTeams)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const teams = await Team.find({ 'stats.gamesPlayed': { $gte: 1 } })
      .sort({ eloTeams: -1 })
      .limit(50)
      .select('name tag ownerId eloTeams stats');
    res.json(teams);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/teams/:id/invite — invite a player
router.post('/:id/invite', requireProfile, async (req: AuthRequest, res: Response) => {
  const { targetProfileId } = req.body as { targetProfileId?: string };
  if (!targetProfileId) {
    res.status(400).json({ error: 'targetProfileId required' });
    return;
  }
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if (team.ownerId !== req.profile!._id.toString()) {
      res.status(403).json({ error: 'Only the team owner can invite' });
      return;
    }
    const alreadyMember = team.members.some((m) => m.profileId === targetProfileId);
    if (alreadyMember) {
      res.status(409).json({ error: 'Already a member' });
      return;
    }
    const existingInvite = team.invites.find(
      (i) => i.profileId === targetProfileId && i.status === 'pending',
    );
    if (existingInvite) {
      res.status(409).json({ error: 'Invite already pending' });
      return;
    }
    team.invites.push({ profileId: targetProfileId, status: 'pending', invitedAt: new Date() });
    await team.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/teams/:id/accept — accept an invite
router.post('/:id/accept', requireProfile, async (req: AuthRequest, res: Response) => {
  const profileId = req.profile!._id.toString();
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    const invite = team.invites.find((i) => i.profileId === profileId && i.status === 'pending');
    if (!invite) {
      res.status(404).json({ error: 'No pending invite found' });
      return;
    }
    invite.status = 'accepted';
    team.members.push({ profileId, role: 'member', joinedAt: new Date() });
    await team.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/teams/:id/leave — leave or disband team
router.delete('/:id/leave', requireProfile, async (req: AuthRequest, res: Response) => {
  const profileId = req.profile!._id.toString();
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if (team.ownerId === profileId) {
      // Owner disbands the team
      await Team.deleteOne({ _id: team._id });
      res.json({ disbanded: true });
      return;
    }
    team.members = team.members.filter((m) => m.profileId !== profileId);
    await team.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export { router as teamsRouter };
