import { injectable, inject } from "tsyringe";
import { userCache, isRedisAvailable } from "@infra/Redis";
import { toSafeUser } from "@/lib/mappers/user";
import type { SafeUser, UserResult } from "@repo/types";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";
import type { SessionRepositoryInterface } from "@/app/Repositories/Contracts/SessionRepositoryInterface";

@injectable()
export class ToggleUserStatusAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface, @inject('SessionRepositoryInterface') private readonly sessionRepo: SessionRepositoryInterface) {
    }

    async execute(userId: string): Promise<UserResult> {
        const targetUser = await this.userRepo.findById(userId);

        if (!targetUser) {
          return { code: 'USER_NOT_FOUND', error: 'User not found' };
        }

        const newStatus = !targetUser.isActive;

        await this.userRepo.updateStatus(userId, newStatus);

        // If deactivating, revoke all active sessions
        if (!newStatus) {
          await this.sessionRepo.revokeActiveSessionsForUser(userId);
        }

        // Invalidate user cache
        if (isRedisAvailable()) {
          await userCache.del(userId);
        }

        // Fetch the updated user to return
        const updatedUser = await this.userRepo.findById(userId);
        const safeUser = toSafeUser(updatedUser!);

        return { data: safeUser as SafeUser };
    }
}
