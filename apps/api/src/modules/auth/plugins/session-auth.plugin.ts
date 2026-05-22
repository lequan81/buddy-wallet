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
import type { UserEntity } from '@repo/types';
import { jwtAuth } from './jwt.plugin';
import { logger } from '@repo/logger';
import { hashToken } from '@/commons/security/password';
import { DEFAULT_USER_PERMISSIONS } from '@/commons/security/permissions';
import { logJWTTampered, logSessionHijack, logSecurityEvent } from '@/commons/security/logger';
import { cache, isRedisAvailable, sessionCache, jwtBlacklist } from '@/providers/redis';
import { UserRepository } from '@/repositories/user/user.repo';
import { SessionRepository } from '@/repositories/auth/session.repo';

import { AUTH_CONSTANTS } from '@repo/config';

const userRepo = new UserRepository();
const sessionRepo = new SessionRepository();
const LAST_ACTIVE_THROTTLE_MS = AUTH_CONSTANTS.SESSION_THROTTLE.LAST_ACTIVE_THROTTLE_MS;
const LAST_ACTIVE_DEDUP_TTL_SECONDS = AUTH_CONSTANTS.SESSION_THROTTLE.LAST_ACTIVE_DEDUP_TTL_SECONDS;

export const sessionAuth = new Elysia({ name: 'Session_Auth' })
  .use(jwtAuth)
  .derive({ as: 'global' }, async function sessionAuth({ jwt, bearer, cookie }): Promise<{
    user: UserEntity | null;
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
      const blacklisted = await jwtBlacklist.isBlacklisted(tokenHash);
      if (blacklisted) {
        logger.jwt(`Token blacklisted`, { source: tokenSource });
        return { user: null, sessionId: null };
      }
    }

    // 3. Verify JWT signature and expiration
    const payload = await jwt.verify(token);
    if (!payload) {
      logger.jwt(`Verification failed`, { source: tokenSource });
      // Security: Log JWT tampering attempt
      logJWTTampered('unknown', { reason: 'Verification failed', source: tokenSource });
      return { user: null, sessionId: null };
    }

    // SECURITY: Validate JWT issuer and audience to prevent token reuse from other systems
    if (payload.iss !== 'buddy-wallet-api' || payload.aud !== 'buddy-wallet-web') {
      logger.jwt(`Invalid JWT issuer or audience`, {
        source: tokenSource,
        iss: payload.iss,
        aud: payload.aud
      });
      logSecurityEvent('jwt_tampered', payload.id as string, {
        reason: 'Invalid issuer or audience',
        iss: payload.iss,
        aud: payload.aud
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
          id: cached.userId,
          role: cached.role || 'user',
          isActive: cached.isActive ?? true,
          permissions: cached.permissions || [],
          email: null,
          phoneNumber: payload.phoneNumber as string
        } as unknown as UserEntity;

        return { user: cachedUser, sessionId: cached.sessionId as string };
      }
    }

    // 3. Validate session is active (not revoked/logged out)
    const session = await sessionRepo.findActiveByAccessTokenHash(payload.id as string, tokenHash);

    if (!session) {
      logger.auth(`Session invalid or revoked`, { userId: payload.id });
      return { user: null, sessionId: null };
    }

    // 4. Get user and check account status
    const user = await userRepo.findById(payload.id as string);

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
      logSessionHijack(user.id, {
        jwtVersion: payload.sessionVersion as number,
        currentVersion: user.sessionVersion || 1
      });

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
    const fiveMinsAgo = new Date(Date.now() - LAST_ACTIVE_THROTTLE_MS);
    if (!session.lastActiveAt || session.lastActiveAt < fiveMinsAgo) {
      // Use the actual session ID from the authenticated session
      const sid = session.id;
      const now = new Date();

      // Deduplicate concurrent updates for the same session over a 5-minute window.
      const dedupKey = `session:last-active:${sid}`;
      const dedupCount = await cache.incr(dedupKey, LAST_ACTIVE_DEDUP_TTL_SECONDS);
      if (dedupCount === 1 || dedupCount < 0) {
        // Background non-blocking update
        Promise.resolve().then(async () => {
          try {
            await sessionRepo.update(sid, { lastActiveAt: now });
          } catch (error) {
            logger.error(`Failed to update lastActiveAt for session ${sid}`, { error: String(error) });
          }
        });
      }
    }

    // Convert DB User to UserEntity (handle nullable/empty permissions by falling back to defaults)
    const userPermissions = (user.permissions && user.permissions.length > 0) 
      ? user.permissions 
      : DEFAULT_USER_PERMISSIONS as string[];
    
    logger.auth('User authenticated successfully', { userId: user.id, permissionCount: userPermissions.length });

    // 6. Cache session data in Redis (reduces future DB queries)
    if (isRedisAvailable()) {
      await sessionCache.set(tokenHash, {
        userId: user.id,
        sessionId: session.id,
        role: user.role,
        isActive: user.isActive,
        permissions: userPermissions // Use the resolved permissions (with fallback)
      });
    }

    logger.jwt(`Session authenticated`, {
      userId: user.id,
      sessionId: session.id,
      source: tokenSource
    });

    const userEntity: UserEntity = {
      ...user,
      permissions: userPermissions
    };

    return { user: userEntity, sessionId: session.id };
  });

/**
 * Get fresh user data from database (bypassing cache)
 */
export async function getUserWithFreshData(userId: string): Promise<UserEntity | null> {
  const user = await userRepo.findById(userId);
  if (!user) return null;

  const userPermissions = (user.permissions && user.permissions.length > 0)
    ? user.permissions
    : DEFAULT_USER_PERMISSIONS as string[];

  return {
    ...user,
    permissions: userPermissions
  };
}

