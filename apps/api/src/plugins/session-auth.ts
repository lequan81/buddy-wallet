/**
 * Session-based Authentication Plugin
 *
 * Handles the full authentication flow:
 * 1. Extract token from Bearer header or Cookie
 * 2. Check JWT blacklist (for revoked tokens)
 * 3. Check Redis cache for session data (reduces DB queries)
 * 4. Verify JWT signature
 * 5. Validate session is still active (not revoked)
 * 6. Check user account status
 * 7. Update last active timestamp
 * 8. Cache session data in Redis
 */

import { Elysia } from 'elysia';
import { db, users, sessions, eq, and, type User } from '@repo/db';
import { jwtPlugin } from './jwt';
import { logger } from '@utils/logger';
import { sessionCache, jwtBlacklist, isRedisAvailable } from './redis';
import { hashToken } from '@utils';

export const sessionAuthPlugin = new Elysia({ name: 'Session_Auth' })
  .use(jwtPlugin)
  .derive({ as: 'global' }, async function sessionAuth({ jwt, bearer, cookie }): Promise<{
    user: User | null;
    sessionId: string | null;
  }> {
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

    // 2. Check JWT blacklist first (fast rejection of revoked tokens)
    if (isRedisAvailable()) {
      const isBlacklisted = await jwtBlacklist.isBlacklisted(token);
      if (isBlacklisted) {
        logger.jwt(`Token blacklisted`, { source: tokenSource });
        return { user: null, sessionId: null };
      }
    }

    // 3. Verify JWT signature and expiration
    const payload = await jwt.verify(token);
    if (!payload) {
      logger.jwt(`Verification failed`, { source: tokenSource });
      return { user: null, sessionId: null };
    }

    logger.jwt(`Token verified`, { source: tokenSource, userId: payload.id });

    // 3.5. Check Redis cache first (avoids DB query)
    if (isRedisAvailable()) {
      // sessionCache now handles hashing internally
      const cached = await sessionCache.get(token);

      if (cached && cached.userId && cached.sessionId) {
        logger.jwt(`Session from cache`, { userId: payload.id });
        // Reconstruct minimal user object from cache
        const cachedUser = {
          id: cached.userId as string,
          role: (cached.role as string) || 'user',
          isActive: (cached.isActive as boolean) ?? true,
          permissions: (cached.permissions as string[]) || []
        } as unknown as User;

        return { user: cachedUser, sessionId: cached.sessionId as string };
      }
    }

    // 3. Validate session is active (not revoked/logged out)
    const session = db
      .select()
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
      // Invalidate cache if user is deactivated
      if (isRedisAvailable()) {
        await sessionCache.del(token);
      }
      return { user: null, sessionId: session.id };
    }

    // 5. Update last active timestamp (fire and forget)
    db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, session.id)).run();

    // 6. Cache session data in Redis (reduces future DB queries)
    if (isRedisAvailable()) {
      await sessionCache.set(token, {
        userId: user.id,
        sessionId: session.id,
        role: user.role,
        isActive: user.isActive,
        permissions: user.permissions
      });
    }

    logger.jwt(`Session authenticated`, {
      userId: user.id,
      sessionId: session.id,
      source: tokenSource
    });

    return { user, sessionId: session.id };
  });
