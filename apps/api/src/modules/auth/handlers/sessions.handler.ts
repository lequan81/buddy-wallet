/**
 * Session Management Handler
 * @logicType http
 *
 * Lists active sessions and revokes individual sessions.
 */

import { SessionRepository } from '@/repositories/auth/session.repo';
import { apiSuccess, apiError } from '@/commons/http/response';
import { GEN_ERRORS } from '@repo/errors';
import { isRedisAvailable, sessionCache, sessionMetaCache } from '@/providers/redis';
import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';

const sessionRepo = new SessionRepository();

export const sessionsHandler = {
  /** GET /auth/sessions — List active sessions for current user */
  list: async ({ user, sessionId }: AuthenticatedHandlerContext) => {
    const dbSessions = await sessionRepo.findActiveByUserId(user.id);

    // Enrich with Redis metadata (userAgent, ipAddress, location)
    const sessions = await Promise.all(
      dbSessions.map(async (s) => {
        let meta: Record<string, unknown> | null = null;
        if (isRedisAvailable()) {
          meta = await sessionMetaCache.get(s.id);
        }
        return {
          id: s.id,
          deviceName: s.deviceName || meta?.deviceName || 'Unknown Device',
          deviceType: s.deviceType || 'unknown',
          ipAddress: s.ipAddress || meta?.ipAddress || null,
          location: s.location || meta?.location || null,
          lastActiveAt: s.lastActiveAt || s.createdAt,
          createdAt: s.createdAt
        };
      })
    );

    // The current session is determined by the access token hash in the request.
    // Since we don't have direct access to the token hash here, the frontend
    // already knows its session ID from locals.sessionId set by the sessionAuth plugin.
    // However, this handler context doesn't expose sessionId directly.
    // We return all sessions; the frontend can match by session metadata.

    return apiSuccess({ sessions, currentSessionId: sessionId || '' });
  },

  /** DELETE /auth/sessions/:id — Revoke a specific session */
  revoke: async ({
    params,
    user
  }: AuthenticatedHandlerContext<unknown, { id: string }>) => {
    const session = await sessionRepo.findActiveByIdAndUser(params.id, user.id);
    if (!session) {
      return apiError(GEN_ERRORS.NOT_FOUND, 'Session not found');
    }

    await sessionRepo.revokeById(params.id, 'user_revoked');

    // Invalidate caches
    if (isRedisAvailable()) {
      await sessionMetaCache.delete(params.id);
      // Also invalidate session cache by access token hash
      if (session.accessTokenHash) {
        await sessionCache.del(session.accessTokenHash);
      }
    }

    return apiSuccess({ revoked: true });
  }
};

