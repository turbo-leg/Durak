import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as Sentry from '@sentry/node';
import type { Logger } from 'pino';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { User } from '../models/User';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'iloveyou',
  'admin123',
  'letmein1',
  'welcome1',
  'monkey123',
  'dragon123',
  'master123',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'abc12345',
  'shadow123',
  'superman',
  'michael1',
  'jessica1',
  'charlie1',
]);

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Internal server error');

interface AuthDeps {
  jwtSecret: string;
  logger: Logger;
}

type OAuthInput = {
  provider: 'google' | 'apple';
  providerId: string;
  email?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
};

export function createAuthRouter({ jwtSecret, logger }: AuthDeps): Router {
  const router = Router();

  // OAuth config — read at factory-call time (after dotenv has loaded).
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const APPLE_SERVICES_ID = process.env.APPLE_SERVICES_ID; // web "Services ID"
  const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID; // native iOS bundle identifier
  const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
  const APPLE_AUDIENCE = [APPLE_SERVICES_ID, APPLE_BUNDLE_ID].filter(Boolean) as string[];

  // Find an existing account for an OAuth identity, or create one.
  // Linking: match first by provider id, then auto-link by email, else create new.
  async function findOrCreateOAuthUser(input: OAuthInput) {
    const providerKey = input.provider === 'google' ? 'googleId' : 'appleId';
    const email = input.email?.toLowerCase().trim() || undefined;

    // 1. Existing account already linked to this provider id.
    let user = await User.findOne({ [providerKey]: input.providerId });

    // 2. Auto-link by email to an existing account.
    if (!user && email) {
      user = await User.findOne({ email });
      if (user && !user.get(providerKey)) {
        user.set(providerKey, input.providerId);
        if (!user.avatarUrl && input.avatarUrl) user.avatarUrl = input.avatarUrl;
        await user.save();
      }
    }

    // 3. Create a fresh account.
    if (!user) {
      const fallbackName =
        input.username?.trim() || email?.split('@')[0] || `Player-${input.providerId.slice(-6)}`;
      user = await User.create({
        email,
        username: fallbackName.slice(0, 32),
        avatarUrl: input.avatarUrl || '',
        authProvider: input.provider,
        [providerKey]: input.providerId,
      });
    }

    const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, { expiresIn: '30d' });
    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email ?? null,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  // ── Discord token exchange (Embedded App SDK) ──────────────────────────────
  router.post('/token', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ error: 'Missing authorization code' });
        return;
      }

      const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;
      if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        res.status(500).json({ error: 'Missing Discord credentials in server environment' });
        return;
      }

      const params: Record<string, string> = {
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
      };
      if (req.body.redirect_uri) params.redirect_uri = String(req.body.redirect_uri);

      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });

      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json(data);
        return;
      }

      res.json(data);
    } catch (error: unknown) {
      Sentry.captureException(error);
      logger.error({ err: error }, 'Token exchange error');
      res.status(500).json({ error: errMsg(error) });
    }
  });

  // Issue a server-signed JWT for Discord users so they can use authenticated API endpoints
  router.post('/auth/discord/session', async (req, res) => {
    try {
      const { access_token } = req.body;
      if (!access_token) {
        res.status(400).json({ error: 'Missing access_token' });
        return;
      }
      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!meRes.ok) {
        res.status(401).json({ error: 'Invalid Discord token' });
        return;
      }
      const me = await meRes.json();
      const token = jwt.sign({ discordId: me.id }, jwtSecret, { expiresIn: '30d' });
      res.json({ token });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  // ── Email / password auth ──────────────────────────────────────────────────
  router.post('/auth/register', async (req, res) => {
    try {
      const { email, password, username } = req.body;
      if (!email || !password || !username) {
        res.status(400).json({ error: 'email, password, and username are required' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }
      if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        res
          .status(400)
          .json({ error: 'Password is too common. Please choose a stronger password.' });
        return;
      }

      const exists = await User.findOne({ email: email.toLowerCase().trim() });
      if (exists) {
        res.status(409).json({ error: 'An account with that email already exists' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: email.toLowerCase().trim(),
        passwordHash,
        username: username.trim().slice(0, 32),
      });

      const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, { expiresIn: '30d' });
      res.status(201).json({
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (e: unknown) {
      Sentry.captureException(e);
      logger.error({ err: e }, 'Register error');
      res.status(500).json({ error: errMsg(e) });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'email and password are required' });
        return;
      }

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user || !(await user.comparePassword(password))) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, { expiresIn: '30d' });
      res.json({
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (e: unknown) {
      Sentry.captureException(e);
      logger.error({ err: e }, 'Login error');
      res.status(500).json({ error: errMsg(e) });
    }
  });

  router.get('/auth/me', async (req, res) => {
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }
      const payload = jwt.verify(auth.slice(7), jwtSecret) as { userId: string };
      const user = await User.findById(payload.userId).select('-passwordHash');
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      });
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  // ── Google / Apple sign-in ─────────────────────────────────────────────────
  router.post('/auth/google', async (req, res) => {
    try {
      if (!googleClient || !GOOGLE_CLIENT_ID) {
        res.status(500).json({ error: 'Google sign-in is not configured' });
        return;
      }
      const { credential } = req.body;
      if (!credential) {
        res.status(400).json({ error: 'Missing credential' });
        return;
      }
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        res.status(401).json({ error: 'Invalid Google token' });
        return;
      }
      const result = await findOrCreateOAuthUser({
        provider: 'google',
        providerId: payload.sub,
        email: payload.email_verified ? payload.email : undefined,
        username: payload.name,
        avatarUrl: payload.picture,
      });
      res.json(result);
    } catch (e: unknown) {
      Sentry.captureException(e);
      logger.error({ err: e }, 'Google sign-in error');
      res.status(401).json({ error: 'Google sign-in failed' });
    }
  });

  router.post('/auth/apple', async (req, res) => {
    try {
      if (APPLE_AUDIENCE.length === 0) {
        res.status(500).json({ error: 'Apple sign-in is not configured' });
        return;
      }
      const { identityToken, fullName } = req.body;
      if (!identityToken) {
        res.status(400).json({ error: 'Missing identityToken' });
        return;
      }
      const payload = await appleSignin.verifyIdToken(identityToken, {
        audience: APPLE_AUDIENCE,
      });
      if (!payload?.sub) {
        res.status(401).json({ error: 'Invalid Apple token' });
        return;
      }
      // Apple only includes the user's name on the first authorization; it arrives
      // from the client, not inside the token. Email may be a private-relay address
      // or absent on subsequent logins.
      const result = await findOrCreateOAuthUser({
        provider: 'apple',
        providerId: payload.sub,
        email: payload.email,
        username: typeof fullName === 'string' ? fullName : undefined,
      });
      res.json(result);
    } catch (e: unknown) {
      Sentry.captureException(e);
      logger.error({ err: e }, 'Apple sign-in error');
      res.status(401).json({ error: 'Apple sign-in failed' });
    }
  });

  return router;
}
