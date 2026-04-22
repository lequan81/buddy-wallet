import { injectable, inject } from 'tsyringe';
import { authConfig } from '@/config';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@infra/Redis';
import { hashToken, generateSecureToken } from '@/lib/security/password';
import { toSafeUser, toSessionInfoList } from '@/lib/mappers';
import type { RefreshSessionResult, Result, SessionListData, RevokeSessionData, RequestInfo, JwtService } from '@repo/types';
import type { SessionRepositoryInterface } from '@/app/Repositories/Contracts/SessionRepositoryInterface';
import type { UserRepositoryInterface } from '@/app/Repositories/Contracts/UserRepositoryInterface';

@injectable()
export class SessionService {
  constructor(
    @inject('SessionRepositoryInterface') private sessionRepo: SessionRepositoryInterface,
    @inject('UserRepositoryInterface') private userRepo: UserRepositoryInterface
  ) { }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshSession(
    refreshToken: string,
    jwt: JwtService,
    requestInfo: RequestInfo
  ): Promise<RefreshSessionResult> {
    if (!refreshToken) {
      return { code: 'MISSING_TOKEN', error: 'No refresh token provided' };
    }

    const refreshTokenHash = await hashToken(refreshToken);

    const session = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);

    if (!session) {
      return { code: 'SESSION_EXPIRED', error: 'Session revoked or expired' };
    }

    const user = await this.userRepo.findById(session.userId);
    if (!user) {
      return { code: 'USER_NOT_FOUND', error: 'User not found' };
    }

    if (!user.isActive) {
      await this.sessionRepo.revokeById(session.id, 'admin_revoke');
      return { code: 'ACCOUNT_DEACTIVATED', error: 'Account is deactivated' };
    }

    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + authConfig.ACCESS_TOKEN_LIFETIME);
    
    const newAccessToken = await jwt.sign({
      id: user.id,
      phoneNumber: user.phoneNumber,
      sessionVersion: user.sessionVersion || 1,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    });

    // REFRESH TOKEN ROTATION: Generate new refresh token
    const newRefreshToken = generateSecureToken(32);
    const newRefreshTokenHash = await hashToken(newRefreshToken);
    const newAccessTokenHash = await hashToken(newAccessToken);
    const refreshTokenExpiresAt = new Date(now + authConfig.REFRESH_TOKEN_LIFETIME);

    // Invalidate old session cache
    if (isRedisAvailable() && session.accessTokenHash) {
      await sessionCache.del(session.accessTokenHash);
    }

    await this.sessionRepo.update(session.id, {
      accessTokenHash: newAccessTokenHash,
      accessTokenExpiresAt,
      refreshToken: newRefreshTokenHash,
      refreshTokenExpiresAt,
      lastRefreshedAt: new Date(),
      lastActiveAt: new Date(),
      userAgent: requestInfo.userAgent || session.userAgent,
      ipAddress: requestInfo.clientIP || session.ipAddress
    });

    return {
      data: {
        user: toSafeUser(user),
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: authConfig.ACCESS_TOKEN_LIFETIME / 1000
      }
    };
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentRefreshToken?: string
  ): Promise<Result<SessionListData>> {
    let currentSessionId: string | null = null;
    if (currentRefreshToken) {
      const refreshTokenHash = await hashToken(currentRefreshToken);
      const currentSession = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);
      currentSessionId = currentSession?.id || null;
    }

    const activeSessions = await this.sessionRepo.findActiveByUserId(userId);

    return { 
      data: { 
        sessions: toSessionInfoList(activeSessions), 
        currentSessionId 
      } 
    };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    currentRefreshToken?: string
  ): Promise<Result<RevokeSessionData>> {
    const session = await this.sessionRepo.findActiveByIdAndUser(sessionId, userId);

    if (!session) {
      return { code: 'NOT_FOUND', error: 'Session not found or already revoked' };
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

    return { data: { isCurrent } };
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string): Promise<Result<{ count: number }>> {
    const revokeResult = await this.sessionRepo.revokeAllForUser(userId);
    const revokedSessions = Array.isArray(revokeResult) ? revokeResult : [];
    const revokedCount = Array.isArray(revokeResult)
      ? revokeResult.length
      : typeof revokeResult === 'number'
        ? revokeResult
        : 0;

    if (isRedisAvailable() && revokedSessions.length > 0) {
      await Promise.allSettled(
        revokedSessions.map(async (s) => {
          if (!s.accessTokenHash) return;
          await sessionCache.del(s.accessTokenHash);
          await jwtBlacklist.add(s.accessTokenHash, authConfig.JWT_BLACKLIST_SECONDS);
        })
      );
    }

    return { data: { count: revokedCount } };
  }
}

