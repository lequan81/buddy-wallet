import { injectable, inject } from "tsyringe";
import { configs } from "@/config";
import { log } from "@repo/logger";
import type { Result } from "@repo/types";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";

@injectable()
export class CompleteResetAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(userId: string, newPassword: string): Promise<Result<void>> {
        const hashedPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

        await this.userRepo.update(userId, {
          password: hashedPassword,
          temporaryPassword: null,
          temporaryPasswordExpires: null,
          temporaryPasswordUsed: false,
          mustChangePassword: false,
          lastPasswordChangeAt: new Date()
        });

        log.info('PASSWORD_RESET', 'Password reset completed', { userId });
        return { data: undefined };
    }
}
