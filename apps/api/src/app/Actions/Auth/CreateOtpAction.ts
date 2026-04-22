import { injectable, inject } from "tsyringe";
import { randomUUIDv7 } from "bun";
import { hashToken } from "@/lib/security/password";
import { authConfig } from "@/config/auth";
import type { CreateOtpResult } from "@/app/Repositories/Contracts/Types/auth";
import type { EmailVerificationRepositoryInterface } from "@/app/Repositories/Contracts";
import { logger } from "@repo/logger";

@injectable()
export class CreateOtpAction {
    constructor(@inject('EmailVerificationRepositoryInterface') private readonly emailVerificationRepo: EmailVerificationRepositoryInterface) {
    }

    async execute(userId: string, email: string): Promise<CreateOtpResult> {
        const otp = this.generateOtp();
        const otpHash = await hashToken(otp);

        // Invalidate any existing unverified OTPs for this user/email
        await this.emailVerificationRepo.invalidateExisting(userId, email);

        // Create new OTP record
        await this.emailVerificationRepo.create({
          id: randomUUIDv7('base64url'),
          userId,
          email,
          otpHash,
          expiresAt: new Date(Date.now() + authConfig.OTP.EXPIRY_MINUTES * 60 * 1000),
          maxAttempts: authConfig.OTP.MAX_ATTEMPTS
        });

        logger.debug('OTP created', { userId, email });
        return { data: { otp } };
    }

    private generateOtp(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
}
