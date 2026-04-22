import { injectable, inject } from "tsyringe";
import { authConfig } from "@/config";
import { sessionCache, jwtBlacklist, isRedisAvailable } from "@infra/Redis";
import type { Result } from "@repo/types";
import type { SessionRepositoryInterface } from "@/app/Repositories/Contracts/SessionRepositoryInterface";

@injectable()
export class RevokeAllSessionsAction {
    constructor(@inject('SessionRepositoryInterface') private sessionRepo: SessionRepositoryInterface) {
    }

    async execute(userId: string): Promise<Result<{ count: number }>> {
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
