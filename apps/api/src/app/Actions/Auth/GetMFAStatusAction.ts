import { injectable, inject } from "tsyringe";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";
import type { MFAStatus, UserMFA } from "@/app/Repositories/Contracts/Types/auth";

@injectable()
export class GetMFAStatusAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(userId: string): Promise<MFAStatus> {
        const user = await this.userRepo.findById(userId) as UserMFA | null;
        if (!user) {
          throw new Error('User not found');
        }

        return {
          enabled: user.mfaEnabled || false,
          method: (user.mfaMethod as 'totp') || null,
          lastVerifiedAt: user.mfaLastVerifiedAt || null
        };
    }
}
