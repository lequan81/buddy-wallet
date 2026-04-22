import { injectable, inject } from "tsyringe";
import { hashToken } from "@/lib/security/password";
import { toSessionInfoList } from "@/lib/mappers";
import type { Result, SessionListData } from "@repo/types";
import type { SessionRepositoryInterface } from "@/app/Repositories/Contracts/SessionRepositoryInterface";

@injectable()
export class GetUserSessionsAction {
    constructor(@inject('SessionRepositoryInterface') private sessionRepo: SessionRepositoryInterface) {
    }

    async execute(userId: string, currentRefreshToken?: string): Promise<Result<SessionListData>> {
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
}
