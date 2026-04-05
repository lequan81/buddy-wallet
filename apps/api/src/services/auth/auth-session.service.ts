/**
 * Auth Session Service
 * 
 * Handles session management operations:
 * - Logout / session revocation
 * - Password change with session management
 * 
 * Dependencies: db
 */
import { configs } from '../../configs';
import type { IUserRepository, ISessionRepository } from '@/types/repositories';
import {
  hashToken,
  validatePasswordComplexity,
  isCommonPassword
} from '@utils';

/**
 * AuthSessionService - Session management and password changes
 */
export class AuthSessionService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly sessionRepo: ISessionRepository
  ) {}

  /**
   * Logout - revoke a session
   */
  async logout(
    refreshToken: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!refreshToken) {
      return { success: false, error: 'No refresh token provided' };
    }

    const refreshTokenHash = await hashToken(refreshToken);

    const session = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);

    if (session && userId && session.userId !== userId) {
      return { success: false, error: 'Session does not belong to user' };
    }

    if (session) {
      await this.sessionRepo.revokeById(session.id, 'user_logout');
    }

    return { success: true };
  }

  /**
   * Change password and revoke other sessions
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const dbUser = await this.userRepo.findById(userId);
    if (!dbUser) {
      return { success: false, error: 'User not found' };
    }

    const validPassword = await Bun.password.verify(currentPassword, dbUser.password);
    if (!validPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // SECURITY: Validate new password complexity
    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. ')
      };
    }

    // SECURITY: Check against common passwords
    if (isCommonPassword(newPassword)) {
      return {
        success: false,
        error: 'Password is too common. Please choose a stronger password.'
      };
    }

    const hashedNewPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

    await this.userRepo.update(userId, {
      password: hashedNewPassword,
      sessionVersion: (dbUser.sessionVersion || 1) + 1,
      lastPasswordChangeAt: new Date()
    });

    if (currentSessionId) {
      await this.sessionRepo.revokeOthers(userId, currentSessionId, 'password_change');
    }

    return { success: true };
  }
}
