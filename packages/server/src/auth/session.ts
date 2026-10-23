import jwt from 'jsonwebtoken';

const DEVELOPMENT_SECRET = 'durak-dev-secret-change-in-prod';
const PLACEHOLDERS = new Set([DEVELOPMENT_SECRET, 'change-me-in-production', 'secret', '']);

export function sessionSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || PLACEHOLDERS.has(secret))) {
    throw new Error('JWT_SECRET is missing or uses an insecure placeholder in production');
  }
  return secret ?? DEVELOPMENT_SECRET;
}

export interface RoomIdentity {
  userId: string;
  discordId: string;
}

export function verifyRoomIdentity(options: Record<string, unknown>): RoomIdentity {
  if (options.token === undefined) {
    if (options.userId || options.discordId)
      throw new Error('Sign in again to verify your identity');
    return { userId: '', discordId: '' };
  }
  if (typeof options.token !== 'string' || options.token.length > 4096) {
    throw new Error('Invalid session token');
  }
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(options.token, sessionSecret(), { algorithms: ['HS256'] });
    if (typeof verified === 'string') throw new Error('Invalid claims');
    payload = verified;
  } catch {
    throw new Error('Invalid or expired session token');
  }
  // Identity comes only from verified claims, never from room options.
  const userId = typeof payload.userId === 'string' ? payload.userId : '';
  const discordId = typeof payload.discordId === 'string' ? payload.discordId : '';
  if (
    !Number.isFinite(payload.exp) ||
    Boolean(userId) === Boolean(discordId) ||
    (userId && !/^[a-f0-9]{24}$/i.test(userId)) ||
    (discordId && !/^\d{1,32}$/.test(discordId))
  )
    throw new Error('Invalid session identity');
  if (
    (options.userId !== undefined && options.userId !== userId) ||
    (options.discordId !== undefined && options.discordId !== discordId)
  )
    throw new Error('Session identity does not match requested player');
  return { userId, discordId };
}
