import { injectable, inject } from "tsyringe";
import { configs } from "@/config";
import { log } from "@repo/logger";
import type { Result } from "@repo/types";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";

@injectable()
export class ResetPasswordWithTokenAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(email: string, token: string, newPassword: string): Promise<Result<void>> {
        const user = await this.userRepo.findByEmail(email);

        if (!user || (user.isLocked && !user.lockoutUntil)) {
          return { code: 'INVALID_RESET_LINK', error: 'Invalid or expired reset link' };
        }

        if (!user.temporaryPassword || !user.temporaryPasswordExpires) {
          return { code: 'INVALID_RESET_LINK', error: 'Invalid or expired reset link' };
        }

        // Check if expired
        if (new Date(user.temporaryPasswordExpires) < new Date()) {
          return { code: 'RESET_LINK_EXPIRED', error: 'Reset link has expired' };
        }

        // Check if already used
        if (user.temporaryPasswordUsed) {
          return { code: 'RESET_LINK_USED', error: 'Reset link has already been used' };
        }

        // Verify token matches hash
        const isValid = await Bun.password.verify(token, user.temporaryPassword);
        if (!isValid) {
          return { code: 'INVALID_RESET_LINK', error: 'Invalid reset link' };
        }

        // Update password and clear temp fields atomically (TOCTOU prevention)
        const hashedPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

        const success = await this.userRepo.consumePasswordResetToken!(
          user.id,
          user.temporaryPassword,
          {
            password: hashedPassword,
            temporaryPassword: null,
            temporaryPasswordExpires: null,
            temporaryPasswordUsed: false,
            mustChangePassword: false,
            lastPasswordChangeAt: new Date(),
            sessionVersion: (user.sessionVersion || 1) + 1,
            isLocked: false,
            lockoutUntil: null,
            failedLoginAttempts: 0
          }
        );

        if (!success) {
          log.warn('PASSWORD_RESET', 'Concurrent reset attempt detected', { userId: user.id });
          return { code: 'CONCURRENT_RESET', error: 'Reset link has already been used or expired' };
        }

        log.info('PASSWORD_RESET', 'Password reset completed via token', { userId: user.id });
        return { data: undefined };
    }
}
