import { injectable, inject } from "tsyringe";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";
import type { SessionRepositoryInterface } from "@/app/Repositories/Contracts/SessionRepositoryInterface";
import { authConfig } from "@/config";
import { validatePasswordComplexity, isCommonPassword } from "@/lib/security/password";
import type { Result } from "@repo/types";

@injectable()
export class ChangePasswordAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface, @inject('SessionRepositoryInterface') private readonly sessionRepo: SessionRepositoryInterface) {
    }

    async execute(userId: string, currentPassword: string, newPassword: string, currentSessionId?: string): Promise<Result<void>> {
        const dbUser = await this.userRepo.findById(userId);
        if (!dbUser) {
          return { code: 'NOT_FOUND', error: 'User not found' };
        }

        const validPassword = await Bun.password.verify(currentPassword, dbUser.password);
        if (!validPassword) {
          return { code: 'INVALID_CREDENTIALS', error: 'Current password is incorrect' };
        }

        // SECURITY: Validate new password complexity
        const passwordValidation = validatePasswordComplexity(newPassword);
        if (!passwordValidation.isValid) {
          return {
            code: 'INVALID_PASSWORD',
            error: passwordValidation.errors.join('. ')
          };
        }

        // SECURITY: Check against common passwords
        if (isCommonPassword(newPassword)) {
          return {
            code: 'WEAK_PASSWORD',
            error: 'Password is too common. Please choose a stronger password.'
          };
        }

        const hashedNewPassword = await Bun.password.hash(newPassword, authConfig.ARGON2_OPTIONS);

        await this.userRepo.update(userId, {
          password: hashedNewPassword,
          sessionVersion: (dbUser.sessionVersion || 1) + 1,
          lastPasswordChangeAt: new Date()
        });

        if (currentSessionId) {
          await this.sessionRepo.revokeOthers(userId, currentSessionId, 'password_change');
        }

        return { data: undefined };
    }
}
