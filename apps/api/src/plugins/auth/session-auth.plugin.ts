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
import { jwtPlugin } from './jwt.plugin';
import { logger } from '@repo/logger';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@plugins/redis';
import { hashToken } from '@utils';
import { logJWTTampered, logSessionHijack, logSecurityEvent } from '@utils/security/logger';

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

    // SECURITY: Hash token once per request
    const tokenHash = await hashToken(token);

    // 2. Check JWT blacklist first (fast rejection of revoked tokens)
    if (isRedisAvailable()) {
      const isBlacklisted = await jwtBlacklist.isBlacklisted(tokenHash);
      if (isBlacklisted) {
        logger.jwt(`Token blacklisted`, { source: tokenSource });
        return { user: null, sessionId: null };
      }
    }

    // 3. Verify JWT signature and expiration
    const payload = await jwt.verify(token);
    if (!payload) {
      logger.jwt(`Verification failed`, { source: tokenSource });
      // Security: Log JWT tampering attempt
      logJWTTampered(undefined, undefined); // IP/UserAgent can be added if available
      return { user: null, sessionId: null };
    }

    // SECURITY: Validate JWT issuer and audience to prevent token reuse from other systems
    if (payload.iss !== 'buddy-wallet-api' || payload.aud !== 'buddy-wallet-web') {
      logger.jwt(`Invalid JWT issuer or audience`, {
        source: tokenSource,
        iss: payload.iss,
        aud: payload.aud
      });
      logSecurityEvent({
        type: 'jwt_tampered',
        userId: payload.id as string,
        details: { reason: 'Invalid issuer or audience', iss: payload.iss, aud: payload.aud }
      });
      return { user: null, sessionId: null };
    }

    logger.jwt(`Token verified`, { source: tokenSource, userId: payload.id });

    // 3.5. Check Redis cache first (avoids DB query)
    if (isRedisAvailable()) {
      const cached = await sessionCache.get(tokenHash);

      if (cached && cached.userId && cached.sessionId) {
        logger.jwt(`Session from cache`, { userId: payload.id });
        // Reconstruct minimal user object from cache
        // SECURITY: PII (phoneNumber, email) from JWT payload or omitted, not cache
        const cachedUser = {
          id: cached.userId as string,
          role: (cached.role as string) || 'user',
          isActive: (cached.isActive as boolean) ?? true,
          permissions: (cached.permissions as string[]) || [],
          email: null, // Email removed from JWT for security - use getUserWithFreshData() when needed
          phoneNumber: payload.phoneNumber // From JWT payload, not cache
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
          eq(sessions.userId, payload.id as string),
          eq(sessions.accessTokenHash, tokenHash), // Lookup by hash, not plaintext
          eq(sessions.status, 'active')
        )
      )
      .get();

    if (!session) {
      logger.auth(`Session invalid or revoked`, { userId: payload.id });
      return { user: null, sessionId: null };
    }

    // 4. Get user and check account status
    const user = db.select().from(users).where(eq(users.id, payload.id as string)).get();

    if (!user) {
      logger.auth(`User not found`, { userId: payload.id });
      return { user: null, sessionId: session.id };
    }

    // SECURITY: Validate sessionVersion for instant token invalidation
    if (payload.sessionVersion !== (user.sessionVersion || 1)) {
      logger.security(`Stale sessionVersion - token invalidated`, {
        userId: user.id,
        jwtVersion: payload.sessionVersion,
        currentVersion: user.sessionVersion,
        reason: 'Password change or forced logout'
      });

      // Security: Log session hijacking attempt
      logSessionHijack(user.id, payload.sessionVersion as number, user.sessionVersion || 1);

      // Invalidate cache for this token
      if (isRedisAvailable()) {
        await sessionCache.del(tokenHash);
      }

      return { user: null, sessionId: session.id };
    }

    if (!user.isActive) {
      logger.auth(`Account deactivated`, { userId: user.id, email: user.email });
      // Invalidate cache if user is deactivated
      if (isRedisAvailable()) {
        await sessionCache.del(tokenHash);
      }
      return { user: null, sessionId: session.id };
    }

    // 5. Update last active timestamp (Throttled to once every 5 minutes)
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!session.lastActiveAt || session.lastActiveAt < fiveMinsAgo) {
      // Use the actual session ID from the authenticated session
      const sid = session.id;
      
      // Background non-blocking update
      Promise.resolve().then(() => {
        try {
          db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sid)).run();
        } catch (error) {
          logger.error(`Failed to update lastActiveAt for session ${sid}`, { error: String(error) });
        }
      });
    }

    // 6. Cache session data in Redis (reduces future DB queries)
    if (isRedisAvailable()) {
      await sessionCache.set(tokenHash, {
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

/**
 * Get fresh user data from database (bypassing cache)
 *
 * USE THIS FOR CRITICAL OPERATIONS:
 * - Debt creation/modification
 * - Payment processing
 * - Authorization decisions that use phoneNumber
 *
 * SECURITY: Ensures phoneNumber is from authoritative database source,
 * not from potentially compromised cache.
 */
export async function getUserWithFreshData(userId: string): Promise<User | null> {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  return user || null;
}
