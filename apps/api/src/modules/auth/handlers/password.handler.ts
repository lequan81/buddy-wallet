/**
 * Password and email verification handlers.
 * @logicType http
 *
 * Password reset flow uses a transaction to atomically update the password
 * and revoke all active sessions, preventing partial state on failure.
 */

import { db } from '@/providers/database';
import { UserRepository } from '@/repositories/user/user.repo';
import { SessionRepository } from '@/repositories/auth/session.repo';
import { EmailVerificationRepository } from '@/repositories/auth/email-verification.repo';
import { hashPassword, hashToken } from '@/commons/security/password';
import { normalizePhoneNumber } from '@repo/utils';
import { BE_ERRORS } from '@repo/errors';
import { apiSuccess, apiError } from '@/commons/http/response';
import {
  validateUserPassword,
  generateResetToken,
  calculateResetTokenExpiry,
  buildResetUrl
} from '../services/auth.service';
import { sendPasswordReset } from '../services/email.service';
import type { VerifyEmailContext, RequestResetContext, ResetContext } from '../types/handler.types';

const userRepo = new UserRepository(db);
const emailVerificationRepo = new EmailVerificationRepository(db);

export const password = {
  verifyEmail: async ({ body }: VerifyEmailContext) => {
    const otpHash = await hashToken(body.token);
    const verification = await emailVerificationRepo.findByOtpHash(otpHash);

    if (!verification) {
      return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    if (verification.expiresAt < new Date()) {
      return apiError(BE_ERRORS.AUTH_TOKEN_EXPIRED);
    }

    // Transaction: mark email verified + invalidate verification record atomically
    await db.transaction(async (tx) => {
      const txUserRepo = new UserRepository(tx);
      const txEmailVerificationRepo = new EmailVerificationRepository(tx);

      await txUserRepo.update(verification.userId, { emailVerified: true });
      await txEmailVerificationRepo.delete(verification.id);
    });

    return apiSuccess({ verified: true }, 'Email verified successfully');
  },

  requestReset: async ({ body }: RequestResetContext) => {
    const identifier = body.identifier;
    if (!identifier) {
      return apiSuccess({ sent: true }, 'If an account exists, a reset link has been sent');
    }

    let user = null;
    if (identifier.includes('@')) {
      user = await userRepo.findByEmail(identifier);
    } else {
      const normalizedPhone = normalizePhoneNumber(identifier);
      if (normalizedPhone) {
        user = await userRepo.findByPhone(normalizedPhone);
      }
    }

    // Email-only reset policy. Always return success to prevent account enumeration.
    if (!user || !user.email) {
      return apiSuccess({ sent: true }, 'If an account exists, a reset link has been sent');
    }

    const resetToken = generateResetToken();
    const tokenHash = await hashToken(resetToken);
    const expiresAt = calculateResetTokenExpiry();

    await userRepo.update(user.id, {
      temporaryPassword: tokenHash,
      temporaryPasswordExpires: expiresAt
    });

    const resetUrl = buildResetUrl(resetToken);
    await sendPasswordReset(user.email, resetUrl, user.name || 'User');

    return apiSuccess({ sent: true }, 'If an account exists, a reset link has been sent');
  },

  reset: async ({ body }: ResetContext) => {
    const { token, newPassword } = body;

    const passwordValidation = validateUserPassword(newPassword);
    if ('code' in passwordValidation) {
      return apiError(BE_ERRORS.INVALID_INPUT, passwordValidation.error);
    }

    const tokenHash = await hashToken(token);
    const user = await userRepo.findByTemporaryPassword(tokenHash);
    if (!user) {
      return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    if (!user.temporaryPasswordExpires || user.temporaryPasswordExpires < new Date()) {
      return apiError(BE_ERRORS.AUTH_TOKEN_EXPIRED);
    }

    const hashedPassword = await hashPassword(newPassword);

    // Transaction: update password + revoke all sessions atomically
    // This prevents a window where the password is changed but old sessions remain valid
    await db.transaction(async (tx) => {
      const txUserRepo = new UserRepository(tx);
      const txSessionRepo = new SessionRepository(tx);

      await txUserRepo.update(user.id, {
        password: hashedPassword,
        temporaryPassword: null,
        temporaryPasswordExpires: null,
        sessionVersion: (user.sessionVersion || 1) + 1
      });

      await txSessionRepo.revokeActiveSessionsForUser(user.id);
    });

    return apiSuccess({ reset: true }, 'Password reset successfully');
  }
};
