/**
 * Session-based Authentication Plugin
 * 
 * Handles the full authentication flow:
 * 1. Extract token from Bearer header or Cookie
 * 2. Verify JWT signature
 * 3. Validate session is still active (not revoked)
 * 4. Check user account status
 * 5. Update last active timestamp
 */

import { Elysia } from 'elysia';
import { db, users, sessions, eq, and } from '@repo/db';
import { jwtPlugin } from './jwt';
import { logger } from '../utils/logger';

export const sessionAuthPlugin = new Elysia({ name: 'Session_Auth' })
  .use(jwtPlugin)
  .derive({ as: 'global' }, async function sessionAuth({ jwt, bearer, cookie }) {
    // 1. Extract token - prioritize Bearer (API calls), fallback to Cookie (browser)
    let token = bearer;
    const tokenSource = bearer ? 'Bearer' : 'Cookie';

    if (!token && cookie?.session?.value) {
      token = String(cookie.session.value);
    }

    // No token provided
    if (!token) {
      logger.jwt('No token provided');
      return { user: null, sessionId: null };
    }

    // 2. Verify JWT signature and expiration
    const payload = await jwt.verify(token);
    if (!payload) {
      logger.jwt(`Verification failed`, { source: tokenSource });
      return { user: null, sessionId: null };
    }

    logger.jwt(`Token verified`, { source: tokenSource, userId: payload.id });

    // 3. Validate session is active (not revoked/logged out)
    const session = db.select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, payload.id),
          eq(sessions.accessToken, token),
          eq(sessions.status, 'active')
        )
      )
      .get();

    if (!session) {
      logger.auth(`Session invalid or revoked`, { userId: payload.id });
      return { user: null, sessionId: null };
    }

    // 4. Get user and check account status
    const user = db.select().from(users).where(eq(users.id, payload.id)).get();

    if (!user) {
      logger.auth(`User not found`, { userId: payload.id });
      return { user: null, sessionId: session.id };
    }

    if (!user.isActive) {
      logger.auth(`Account deactivated`, { userId: user.id, email: user.email });
      return { user: null, sessionId: session.id };
    }

    // 5. Update last active timestamp (fire and forget)
    db.update(sessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(sessions.id, session.id))
      .run();

    logger.jwt(`Session authenticated`, {
      userId: user.id,
      sessionId: session.id,
      source: tokenSource
    });

    return { user, sessionId: session.id };
  });
