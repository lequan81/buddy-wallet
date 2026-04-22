import { injectable, inject } from "tsyringe";
import { toSafeUser } from "@/lib/mappers/user";
import type { SafeUser, PaginatedResult } from "@repo/types";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";

@injectable()
export class GetAllUsersAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(options: { limit?: number; offset?: number } = {}): Promise<PaginatedResult<SafeUser>> {
        const { limit = 50, offset = 0 } = options;

        const { data: paginatedUsers, total } = await this.userRepo.findMany(limit, offset);

        // Strip passwords and sensitive data
        const safeUsers = paginatedUsers.map(toSafeUser);

        return {
          items: safeUsers,
          pagination: {
            page: Math.floor(offset / limit) + 1,
            limit,
            total
          }
        };
    }
}
