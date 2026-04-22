import { injectable, inject } from "tsyringe";
import { hashToken } from "@/lib/security/password";
import type { VerifyOtpResult } from "@/app/Repositories/Contracts/Types/auth";
import type { EmailVerificationRepositoryInterface, UserRepositoryInterface } from "@/app/Repositories/Contracts";
import { logger } from "@repo/logger";

@injectable()
export class VerifyOtpAction {
    constructor(@inject('EmailVerificationRepositoryInterface') private readonly emailVerificationRepo: EmailVerificationRepositoryInterface, @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(email: string, otp: string): Promise<VerifyOtpResult> {
        const otpHash = await hashToken(otp);
        const now = new Date();

        // Find the latest unverified OTP for this email
        const verification = await this.emailVerificationRepo.findLatestUnverified(email);

        if (!verification) {
          return { data: undefined, error: 'No pending verification found', code: 'OTP_NOT_FOUND' };
        }

        // Check if expired
        if (verification.expiresAt < now) {
          return { data: undefined, error: 'OTP has expired. Please request a new one.', code: 'OTP_EXPIRED' };
        }

        // Check if max attempts exceeded
        if (verification.attempts >= verification.maxAttempts) {
          return { data: undefined, error: 'Too many attempts. Please request a new OTP.', code: 'OTP_MAX_ATTEMPTS' };
        }

        // Increment attempts
        await this.emailVerificationRepo.updateAttempts(verification.id, verification.attempts + 1);

        // Verify OTP hash
        if (verification.otpHash !== otpHash) {
          const remainingAttempts = verification.maxAttempts - verification.attempts - 1;
          return {
            data: undefined,
            error: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
            code: 'OTP_INVALID'
          };
        }

        // Mark verification as complete
        await this.emailVerificationRepo.markVerified(verification.id);

        // Update user's emailVerified status
        await this.userRepo.update(verification.userId, { emailVerified: true });

        logger.debug('OTP verified successfully', { email });
        return { data: undefined };
    }
}
