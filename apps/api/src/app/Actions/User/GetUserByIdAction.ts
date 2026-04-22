import { injectable, inject } from "tsyringe";
import { userCache, isRedisAvailable } from "@infra/Redis";
import { toSafeUser } from "@/lib/mappers/user";
import type { SafeUser, UserResult } from "@repo/types";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";

@injectable()
export class GetUserByIdAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(userId: string): Promise<UserResult> {
        // Try cache first
        if (isRedisAvailable()) {
          const cached = await userCache.get(userId) as SafeUser | null;
          if (cached) {
            return { data: cached };
          }
        }

        const user = await this.userRepo.findById(userId);

        if (!user) {
          return { code: 'USER_NOT_FOUND', error: 'User not found' };
        }

        // Strip password and sensitive data
        const safeUser = toSafeUser(user);

        // Cache the user profile
        if (isRedisAvailable()) {
          await userCache.set(userId, safeUser);
        }

        return { data: safeUser };
    }
}
