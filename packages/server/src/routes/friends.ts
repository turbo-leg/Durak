import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Friendship } from '../models/Friendship';
import { PlayerProfile, type IPlayerProfile } from '../models/PlayerProfile';

export const friendsRouter = Router();

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

friendsRouter.use(
  requireProfile as unknown as (req: Request, res: Response, next: NextFunction) => void,
);

friendsRouter.get('/', async (req: Request, res: Response) => {
  const myId = (req as AuthedRequest).profile._id.toString();
  const friendships = await Friendship.find({
    $or: [{ senderId: myId }, { receiverId: myId }],
    status: 'accepted',
  }).lean();

  const otherIds = friendships.map((f) => (f.senderId === myId ? f.receiverId : f.senderId));
  const profiles = await PlayerProfile.find({ _id: { $in: otherIds } })
    .select('username avatarUrl eloClassic')
    .lean();

  res.json(
    profiles.map((p) => ({
      profileId: p._id.toString(),
      username: p.username,
      avatarUrl: p.avatarUrl,
      eloClassic: p.eloClassic,
    })),
  );
});

friendsRouter.get('/pending', async (req: Request, res: Response) => {
  const myId = (req as AuthedRequest).profile._id.toString();
  const pending = await Friendship.find({ receiverId: myId, status: 'pending' }).lean();

  const senderIds = pending.map((f) => f.senderId);
  const profiles = await PlayerProfile.find({ _id: { $in: senderIds } })
    .select('username avatarUrl eloClassic')
    .lean();

  const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));

  res.json(
    pending.map((f) => {
      const sender = profileMap.get(f.senderId);
      return {
        friendshipId: f._id.toString(),
        profileId: f.senderId,
        username: sender?.username ?? '',
        avatarUrl: sender?.avatarUrl ?? '',
        eloClassic: sender?.eloClassic ?? 1000,
      };
    }),
  );
});

friendsRouter.post('/request', async (req: Request, res: Response) => {
  const myId = (req as AuthedRequest).profile._id.toString();
  const { targetProfileId } = req.body as { targetProfileId?: string };

  if (!targetProfileId) {
    res.status(400).json({ error: 'targetProfileId is required' });
    return;
  }
  if (targetProfileId === myId) {
    res.status(400).json({ error: 'Cannot send friend request to yourself' });
    return;
  }

  const existing = await Friendship.findOne({
    $or: [
      { senderId: myId, receiverId: targetProfileId },
      { senderId: targetProfileId, receiverId: myId },
    ],
  });

  if (existing?.status === 'accepted') {
    res.status(409).json({ error: 'Already friends' });
    return;
  }

  const friendship = await Friendship.findOneAndUpdate(
    { senderId: myId, receiverId: targetProfileId },
    { status: 'pending' },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.status(201).json({ friendshipId: friendship._id.toString(), status: friendship.status });
});

friendsRouter.post('/accept', async (req: Request, res: Response) => {
  const myId = (req as AuthedRequest).profile._id.toString();
  const { friendshipId } = req.body as { friendshipId?: string };

  if (!friendshipId) {
    res.status(400).json({ error: 'friendshipId is required' });
    return;
  }

  const friendship = await Friendship.findOneAndUpdate(
    { _id: friendshipId, receiverId: myId, status: 'pending' },
    { status: 'accepted' },
    { new: true },
  );

  if (!friendship) {
    res.status(404).json({ error: 'Pending request not found' });
    return;
  }

  res.json({ friendshipId: friendship._id.toString(), status: friendship.status });
});

friendsRouter.post('/reject', async (req: Request, res: Response) => {
  const myId = (req as AuthedRequest).profile._id.toString();
  const { friendshipId } = req.body as { friendshipId?: string };

  if (!friendshipId) {
    res.status(400).json({ error: 'friendshipId is required' });
    return;
  }

  const friendship = await Friendship.findOneAndUpdate(
    { _id: friendshipId, receiverId: myId, status: 'pending' },
    { status: 'rejected' },
    { new: true },
  );

  if (!friendship) {
    res.status(404).json({ error: 'Pending request not found' });
    return;
  }

  res.json({ friendshipId: friendship._id.toString(), status: friendship.status });
});

friendsRouter.delete('/:profileId', async (req: Request, res: Response) => {
  const myId = (req as AuthedRequest).profile._id.toString();
  const otherId = req.params.profileId;

  const result = await Friendship.deleteOne({
    $or: [
      { senderId: myId, receiverId: otherId },
      { senderId: otherId, receiverId: myId },
    ],
    status: 'accepted',
  });

  if (result.deletedCount === 0) {
    res.status(404).json({ error: 'Friendship not found' });
    return;
  }

  res.json({ ok: true });
});
