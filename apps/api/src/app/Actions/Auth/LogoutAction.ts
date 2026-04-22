import { injectable, inject } from "tsyringe";
import type { SessionRepositoryInterface } from "@/app/Repositories/Contracts/SessionRepositoryInterface";
import { hashToken } from "@/lib/security/password";
import type { Result } from "@repo/types";

@injectable()
export class LogoutAction {
    constructor(@inject('SessionRepositoryInterface') private readonly sessionRepo: SessionRepositoryInterface) {
    }

    async execute(refreshToken: string, userId?: string): Promise<Result<void>> {
        if (!refreshToken) {
          return { code: 'MISSING_TOKEN', error: 'No refresh token provided' };
        }

        const refreshTokenHash = await hashToken(refreshToken);
        const session = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);

        if (session && userId && session.userId !== userId) {
          return { code: 'FORBIDDEN', error: 'Session does not belong to user' };
        }

        if (session) {
          await this.sessionRepo.revokeById(session.id, 'user_logout');
        }

        return { data: undefined };
    }
}
