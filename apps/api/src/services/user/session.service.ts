/**
 * Session Service (Class-based with Dependency Injection)
 *
 * Handles session management: creation, refresh, revocation.
 * Uses constructor injection for testability.
 * Implements ISessionService interface for LSP compliance.
 */
import { configs } from '../../configs';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@plugins/redis';
import { hashToken, generateSecureToken, toSafeUser } from '@utils';
import { logger } from '@repo/logger';
import type { JwtService } from '@/types';
import type { SessionInfo } from '@/types';
import type { ISessionService, RequestInfo as _RequestInfo, RefreshSessionResult } from '@repo/types';
import type { ISessionRepository, IUserRepository } from '@/types/repositories';

/**
 * SessionService class with dependency injection
 * Implements ISessionService for LSP compliance
 */
export class SessionService implements ISessionService {
  constructor(
    private sessionRepo: ISessionRepository,
    private userRepo: IUserRepository
  ) { }

  /**
   * Refresh an access token using a refresh token
   *
   * SECURITY: Implements refresh token rotation (Facebook/Instagram pattern)
   * - Each refresh generates a NEW refresh token
   * - Old refresh token becomes invalid immediately
   * - Prevents refresh token replay attacks
   */
  async refreshSession(
    refreshToken: string,
    jwt: JwtService,
    requestInfo: { userAgent: string | null; clientIP: string | null }
  ): Promise<RefreshSessionResult> {
    if (!refreshToken) {
      return { success: false, error: 'No refresh token provided' };
    }

    const refreshTokenHash = await hashToken(refreshToken);

    const session = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);

    if (!session) {
      return { success: false, error: 'Session revoked or expired' };
    }

    const user = await this.userRepo.findById(session.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.isActive) {
      await this.sessionRepo.revokeById(session.id, 'admin_revoke');
      return { success: false, error: 'Account is deactivated' };
    }

    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + configs.AUTH.ACCESS_TOKEN_LIFETIME);
    const newAccessToken = await jwt.sign({
      id: user.id,
      phoneNumber: user.phoneNumber,
      sessionVersion: user.sessionVersion || 1,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    });

    // REFRESH TOKEN ROTATION: Generate new refresh token
    const newRefreshToken = generateSecureToken(32);
    const newRefreshTokenHash = await hashToken(newRefreshToken);
    const newAccessTokenHash = await hashToken(newAccessToken); // SECURITY: Hash access token
    const refreshTokenExpiresAt = new Date(now + configs.AUTH.REFRESH_TOKEN_LIFETIME);

    // Invalidate old session cache before updating token
    if (isRedisAvailable() && session.accessTokenHash) {
      await sessionCache.del(session.accessTokenHash);
    }

    await this.sessionRepo.update(session.id, {
      accessToken: null, // DEPRECATED: No longer store plaintext
      accessTokenHash: newAccessTokenHash, // Store hashed token
      accessTokenExpiresAt,
      refreshToken: newRefreshTokenHash, // NEW: Store rotated refresh token
      refreshTokenExpiresAt, // NEW: Reset refresh token expiry
      lastRefreshedAt: new Date(),
      lastActiveAt: new Date(),
      userAgent: requestInfo.userAgent || session.userAgent,
      ipAddress: requestInfo.clientIP || session.ipAddress
    });

    return {
      success: true,
      user: toSafeUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken, // NEW: Return new token to client
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
      const currentSession = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);
      currentSessionId = currentSession?.id || null;
    }

    const activeSessions = await this.sessionRepo.findActiveByUserId(userId);

    const formattedSessions = activeSessions.map(session => ({
      id: session.id,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      location: session.location,
      ipAddress: session.ipAddress,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt
    }));

    return { sessions: formattedSessions as SessionInfo[], currentSessionId };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    currentRefreshToken?: string
  ): Promise<{ success: boolean; error?: string; isCurrent?: boolean }> {
    const session = await this.sessionRepo.findActiveByIdAndUser(sessionId, userId);

    if (!session) {
      return { success: false, error: 'Session not found or already revoked' };
    }

    await this.sessionRepo.revokeById(sessionId, 'user_revoked');

    if (isRedisAvailable() && session.accessTokenHash) {
      await sessionCache.del(session.accessTokenHash);
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
    const revokeResult = (await this.sessionRepo.revokeAllForUser(userId)) as unknown;
    const revokedSessions = Array.isArray(revokeResult) ? revokeResult : [];
    const revokedCount = Array.isArray(revokeResult)
      ? revokeResult.length
      : typeof revokeResult === 'number'
        ? revokeResult
        : 0;

    if (isRedisAvailable() && revokedSessions.length > 0) {
      const cacheResults = await Promise.allSettled(
        revokedSessions.map(async (s) => {
          if (!s.accessTokenHash) {
            return;
          }
          await sessionCache.del(s.accessTokenHash);
          await jwtBlacklist.add(s.accessTokenHash, configs.AUTH.JWT_BLACKLIST_SECONDS);
        })
      );

      const failures = cacheResults.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failures.length > 0) {
        logger.error('Session cache revocation failures', {
          userId,
          failedCount: failures.length,
          reasons: failures.map((f) => f.reason)
        });
      }

      return {
        success: failures.length === 0,
        count: revokedCount
      };
    }

    return { success: true, count: revokedCount };
  }
}
