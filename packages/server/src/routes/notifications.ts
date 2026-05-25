import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Friendship } from '../models/Friendship';
import { Team } from '../models/Team';
import { PlayerProfile, type IPlayerProfile } from '../models/PlayerProfile';

export const notificationsRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'durak-dev-secret-change-in-prod';

interface AuthedRequest extends Request {
  profile: IPlayerProfile;
}

async function requireProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    const profile = await PlayerProfile.findOne({ userId: payload.userId });
    if (!profile) {
      res.status(401).json({ error: 'Profile not found' });
      return;
    }
    (req as AuthedRequest).profile = profile;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

notificationsRouter.use(
  requireProfile as unknown as (req: Request, res: Response, next: NextFunction) => void,
);

notificationsRouter.get('/', async (req: Request, res: Response) => {
  const myId = (req as AuthedRequest).profile._id.toString();

  const [pendingFriendships, pendingTeams] = await Promise.all([
    Friendship.find({ receiverId: myId, status: 'pending' }).lean(),
    Team.find({ 'invites.profileId': myId, 'invites.status': 'pending' }).lean(),
  ]);

  const senderIds = pendingFriendships.map((f) => f.senderId);
  const senderProfiles = await PlayerProfile.find({ _id: { $in: senderIds } })
    .select('username avatarUrl')
    .lean();
  const profileMap = new Map(senderProfiles.map((p) => [p._id.toString(), p]));

  const friendNotifications = pendingFriendships.map((f) => {
    const sender = profileMap.get(f.senderId);
    return {
      id: f._id.toString(),
      kind: 'friend_request' as const,
      fromUsername: sender?.username ?? '',
      fromAvatarUrl: sender?.avatarUrl ?? '',
      payload: { friendshipId: f._id.toString() },
      createdAt:
        (f as unknown as { createdAt: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
      read: false,
    };
  });

  const teamNotifications = pendingTeams.flatMap((team) => {
    const myInvite = team.invites.find((inv) => inv.profileId === myId && inv.status === 'pending');
    if (!myInvite) return [];
    return [
      {
        id: `${team._id.toString()}-invite`,
        kind: 'team_invite' as const,
        fromUsername: team.name,
        fromAvatarUrl: '',
        payload: { teamId: team._id.toString(), teamName: team.name },
        createdAt: myInvite.invitedAt?.toISOString() ?? new Date().toISOString(),
        read: false,
      },
    ];
  });

  const notifications = [...friendNotifications, ...teamNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  res.json({ notifications, unreadCount: notifications.length });
});

notificationsRouter.post('/mark-read', (_req: Request, res: Response) => {
  res.json({ ok: true });
});
