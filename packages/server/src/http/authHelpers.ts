import jwt from 'jsonwebtoken';
import { PlayerProfile } from '../models/PlayerProfile';

// Factory so the JWT secret (resolved in index.ts after dotenv loads) is injected
// rather than read at module-import time.
export function createAuthHelpers(jwtSecret: string) {
  // Resolve caller's userId from Bearer JWT. Returns null if invalid/missing.
  function userIdFromToken(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      const payload = jwt.verify(authHeader.slice(7), jwtSecret) as { userId?: string };
      return payload.userId ?? null;
    } catch {
      return null;
    }
  }

  // Resolve caller's discordId from Bearer JWT. Returns null if not a Discord session token.
  function discordIdFromToken(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      const payload = jwt.verify(authHeader.slice(7), jwtSecret) as { discordId?: string };
      return payload.discordId ?? null;
    } catch {
      return null;
    }
  }

  // Resolve caller's PlayerProfile from Bearer JWT (handles both email and Discord users).
  // Creates a profile on first access for Discord users who haven't finished a game yet.
  async function profileFromToken(
    authHeader: string | undefined,
  ): Promise<InstanceType<typeof PlayerProfile> | null> {
    const userId = userIdFromToken(authHeader);
    if (userId) return PlayerProfile.findOne({ userId });
    const discordId = discordIdFromToken(authHeader);
    if (discordId) {
      return PlayerProfile.findOneAndUpdate(
        { discordId },
        { $setOnInsert: { discordId } },
        { upsert: true, new: true },
      );
    }
    return null;
  }

  return { userIdFromToken, discordIdFromToken, profileFromToken };
}

export type AuthHelpers = ReturnType<typeof createAuthHelpers>;
