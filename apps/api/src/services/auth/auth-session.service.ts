/**
 * Auth Session Service
 * 
 * Handles session management operations:
 * - Logout / session revocation
 * - Password change with session management
 * 
 * Dependencies: db
 */
import { users, sessions, eq, and, ne } from '@repo/db';
import { configs } from '../../configs';
import {
  hashToken,
  validatePasswordComplexity,
  isCommonPassword
} from '@utils';
import type { DbClient } from '@/types';

/**
 * AuthSessionService - Session management and password changes
 */
export class AuthSessionService {
  constructor(private db: DbClient) {}

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

    const session = this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshToken, refreshTokenHash))
      .get();

    if (session && userId && session.userId !== userId) {
      return { success: false, error: 'Session does not belong to user' };
    }

    if (session) {
      await this.db
        .update(sessions)
        .set({
          status: 'logged_out',
          revokedAt: new Date(),
          revokedReason: 'user_logout'
        })
        .where(eq(sessions.id, session.id));
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
    const dbUser = this.db.select().from(users).where(eq(users.id, userId)).get();
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

    await this.db
      .update(users)
      .set({
        password: hashedNewPassword,
        sessionVersion: (dbUser.sessionVersion || 1) + 1,
        lastPasswordChangeAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    if (currentSessionId) {
      await this.db
        .update(sessions)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedReason: 'password_change'
        })
        .where(
          and(
            eq(sessions.userId, userId),
            eq(sessions.status, 'active'),
            ne(sessions.id, currentSessionId)
          )
        );
    }

    return { success: true };
  }
}
