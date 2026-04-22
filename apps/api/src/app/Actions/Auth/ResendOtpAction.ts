import { injectable, inject } from "tsyringe";
import { authConfig } from "@/config/auth";
import type { ResendOtpResult } from "@/app/Repositories/Contracts/Types/auth";
import type { EmailVerificationRepositoryInterface, UserRepositoryInterface } from "@/app/Repositories/Contracts";
import { CreateOtpAction } from "./CreateOtpAction";

@injectable()
export class ResendOtpAction {
    constructor(
        @inject('EmailVerificationRepositoryInterface') private readonly emailVerificationRepo: EmailVerificationRepositoryInterface,
        @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface,
        private readonly createOtpAction: CreateOtpAction
    ) {
    }

    async execute(userId: string): Promise<ResendOtpResult> {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Get user to find their email
        const user = await this.userRepo.findById(userId);

        if (!user || !user.email) {
          return { data: undefined, error: 'User has no email registered' };
        }

        if (user.emailVerified) {
          return { data: undefined, error: 'Email is already verified' };
        }

        // Check resend count in last hour
        const recentVerifications = await this.emailVerificationRepo.findAllByUserIdAndEmail(userId, user.email);

        const recentCount = recentVerifications.filter((v) => v.createdAt > oneHourAgo).length;

        if (recentCount >= authConfig.OTP.MAX_RESENDS_PER_HOUR) {
          return {
            data: undefined,
            error: 'Too many OTP requests. Please try again later.',
            retryAfter: 3600 // 1 hour
          };
        }

        // Check cooldown from last send
        const lastVerification = [...recentVerifications].sort(
          (a, b) => b.lastSentAt.getTime() - a.lastSentAt.getTime()
        )[0];

        if (lastVerification) {
          const secondsSinceLastSend = (now.getTime() - lastVerification.lastSentAt.getTime()) / 1000;

          if (secondsSinceLastSend < authConfig.OTP.RESEND_COOLDOWN_SECONDS) {
            return {
              data: undefined,
              error: 'Please wait before requesting a new OTP',
              retryAfter: Math.ceil(authConfig.OTP.RESEND_COOLDOWN_SECONDS - secondsSinceLastSend)
            };
          }
        }

        // Create new OTP
        const result = await this.createOtpAction.execute(userId, user.email);
        return { data: result.data };
    }
}
