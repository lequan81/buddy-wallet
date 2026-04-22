import { injectable, inject } from "tsyringe";
import { authConfig } from "@/config";
import { sessionCache, isRedisAvailable } from "@infra/Redis";
import { hashToken, generateSecureToken } from "@/lib/security/password";
import { toSafeUser } from "@/lib/mappers";
import type { RefreshSessionResult, Result, RequestInfo, JwtService } from "@repo/types";
import type { SessionRepositoryInterface } from "@/app/Repositories/Contracts/SessionRepositoryInterface";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";

@injectable()
export class RefreshSessionAction {
    constructor(@inject('SessionRepositoryInterface') private sessionRepo: SessionRepositoryInterface, @inject('UserRepositoryInterface') private userRepo: UserRepositoryInterface) {
    }

    async execute(refreshToken: string, jwt: JwtService, requestInfo: RequestInfo): Promise<RefreshSessionResult> {
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
}
