/**
 * Session Service (Class-based with Dependency Injection)
 *
 * Handles session management: creation, refresh, revocation.
 * Uses constructor injection for testability.
 */
import { users, sessions, eq, and, gte } from '@repo/db';
import { configs } from '@/configs';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@plugins/redis';
import { hashToken } from '@utils';
import type { DbClient, JwtService } from '@/types';

import type { SessionInfo } from '@/types';

/**
 * SessionService class with dependency injection
 */
export class SessionService {
  constructor(private db: DbClient) {}

  /**
   * Refresh an access token using a refresh token
   */
  async refreshSession(
    refreshToken: string,
    jwt: JwtService,
    requestInfo: { userAgent: string | null; clientIP: string | null }
  ): Promise<{
    success: boolean;
    error?: string;
    user?: { id: string; email: string | null; role: string };
    accessToken?: string;
    expiresIn?: number;
  }> {
    if (!refreshToken) {
      return { success: false, error: 'No refresh token provided' };
    }

    const refreshTokenHash = await hashToken(refreshToken);

    const session = this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshToken, refreshTokenHash),
          eq(sessions.status, 'active'),
          gte(sessions.refreshTokenExpiresAt, new Date())
        )
      )
      .get();

    if (!session) {
      return { success: false, error: 'Session revoked or expired' };
    }

    const user = this.db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.isActive) {
      await this.db
        .update(sessions)
        .set({ status: 'revoked', revokedAt: new Date(), revokedReason: 'admin_revoke' })
        .where(eq(sessions.id, session.id));
      return { success: false, error: 'Account is deactivated' };
    }

    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + configs.AUTH.ACCESS_TOKEN_LIFETIME);
    const newAccessToken = await jwt.sign({
      id: user.id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    });

    await this.db
      .update(sessions)
      .set({
        accessToken: newAccessToken,
        accessTokenExpiresAt,
        lastRefreshedAt: new Date(),
        lastActiveAt: new Date(),
        userAgent: requestInfo.userAgent || session.userAgent,
        ipAddress: requestInfo.clientIP || session.ipAddress
      })
      .where(eq(sessions.id, session.id));

    return {
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
      accessToken: newAccessToken,
      expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
    };
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentRefreshToken?: string
  ): Promise<{
    sessions: SessionInfo[];
    currentSessionId: string | null;
  }> {
    let currentSessionId: string | null = null;
    if (currentRefreshToken) {
      const refreshTokenHash = await hashToken(currentRefreshToken);
      const currentSession = this.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.refreshToken, refreshTokenHash))
        .get();
      currentSessionId = currentSession?.id || null;
    }

    const activeSessions = this.db
      .select({
        id: sessions.id,
        deviceName: sessions.deviceName,
        deviceType: sessions.deviceType,
        location: sessions.location,
        ipAddress: sessions.ipAddress,
        lastActiveAt: sessions.lastActiveAt,
        createdAt: sessions.createdAt
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .orderBy(sessions.lastActiveAt)
      .all();

    return { sessions: activeSessions, currentSessionId };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    currentRefreshToken?: string
  ): Promise<{ success: boolean; error?: string; isCurrent?: boolean }> {
    const session = this.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, userId), eq(sessions.status, 'active'))
      )
      .get();

    if (!session) {
      return { success: false, error: 'Session not found or already revoked' };
    }

    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'user_revoked' as const
      })
      .where(eq(sessions.id, sessionId));

    if (isRedisAvailable() && session.accessToken) {
      await sessionCache.del(session.accessToken);
    }

    let isCurrent = false;
    if (currentRefreshToken) {
      const currentHash = await hashToken(currentRefreshToken);
      isCurrent = session.refreshToken === currentHash;
    }

    return { success: true, isCurrent };
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string): Promise<{ success: boolean; count: number }> {
    const activeSessions = this.db
      .select({ id: sessions.id, accessToken: sessions.accessToken })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .all();

    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'logout_all_devices'
      })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));

    if (isRedisAvailable()) {
      await Promise.all(
        activeSessions.map(async (s) => {
          if (s.accessToken) {
            await sessionCache.del(s.accessToken);
            await jwtBlacklist.add(s.accessToken, configs.AUTH.JWT_BLACKLIST_SECONDS);
          }
        })
      );
    }

    return { success: true, count: activeSessions.length };
  }
}
