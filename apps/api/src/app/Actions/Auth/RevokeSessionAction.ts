import { injectable, inject } from "tsyringe";
import { sessionCache, isRedisAvailable } from "@infra/Redis";
import { hashToken } from "@/lib/security/password";
import type { Result, RevokeSessionData } from "@repo/types";
import type { SessionRepositoryInterface } from "@/app/Repositories/Contracts/SessionRepositoryInterface";

@injectable()
export class RevokeSessionAction {
    constructor(@inject('SessionRepositoryInterface') private sessionRepo: SessionRepositoryInterface) {
    }

    async execute(sessionId: string, userId: string, currentRefreshToken?: string): Promise<Result<RevokeSessionData>> {
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
}
