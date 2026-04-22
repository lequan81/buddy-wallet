import { injectable, inject } from "tsyringe";
import type { EmailVerificationRepositoryInterface, UserRepositoryInterface } from "@/app/Repositories/Contracts";

@injectable()
export class GetVerificationStatusAction {
    constructor(@inject('EmailVerificationRepositoryInterface') private readonly emailVerificationRepo: EmailVerificationRepositoryInterface, @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(userId: string): Promise<{
            email: string | null;
            emailVerified: boolean;
            pendingVerification: boolean;
          }> {
        const user = await this.userRepo.findById(userId);

        if (!user) {
          return { email: null, emailVerified: false, pendingVerification: false };
        }

        // Check if there's a pending verification
        const pendingCount = await this.emailVerificationRepo.getPendingCount(userId);

        return {
          email: user.email,
          emailVerified: user.emailVerified,
          pendingVerification: pendingCount > 0
        };
    }
}
