/**
 * Password Reset Service
 *
 * Handles password reset flow:
 * 1. Verify email + phone combination
 * 2. Generate temporary password
 * 3. Send via email
 * 4. Force password change on login
 */
import { normalizePhoneNumber, redactIdentifier } from '@utils';
import { escapeHtml } from '@repo/utils';
import { configs } from '@/configs';
import { log } from '@repo/logger';
import type { Result } from '@repo/types';
import type { IUserRepository } from '@/types/repositories';
import { EmailService } from './email.service';

import * as crypto from 'node:crypto';

// Configuration alias for readability
const { PASSWORD_RESET } = configs.AUTH;

/**
 * Generate a secure random token for password reset
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Remove local redactIdentifier

export class PasswordResetService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailService: EmailService
  ) {}

  /**
   * Request password reset
   * Verifies email + phone match, generates temp password, sends email
   */
  async requestReset(email: string, phoneNumber: string): Promise<Result<void>> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone) {
      return { code: 'INVALID_PHONE', error: 'Invalid phone number format' };
    }

    // Find user with matching email AND phone
    const user = await this.userRepo.findByEmailAndPhone(email, normalizedPhone);

    if (!user) {
      // SECURITY: Don't reveal if email/phone exists - use generic message
      log.warn('PASSWORD_RESET', 'Reset attempt with non-matching credentials', {
        identifierHash: redactIdentifier(email)
      });
      return {
        code: 'INVALID_CREDENTIALS',
        error:
          'If the email and phone number match our records, you will receive reset instructions.'
      };
    }

    // Only block if permanently locked (by admin). Auto-lockouts have a lockoutUntil date.
    if (user.isLocked && !user.lockoutUntil) {
      return { code: 'ACCOUNT_LOCKED', error: 'Account is locked. Please contact support.' };
    }

    // Check if there's already a valid temp password
    if (user.temporaryPassword && user.temporaryPasswordExpires) {
      const expiresAt = new Date(user.temporaryPasswordExpires);
      if (expiresAt > new Date() && !user.temporaryPasswordUsed) {
        return {
          code: 'RESET_IN_PROGRESS',
          error:
            'A temporary password was already sent. Please check your email or wait for it to expire.'
        };
      }
    }

    // Generate reset token
    const token = generateResetToken();
    const hashedToken = await Bun.password.hash(token, configs.AUTH.ARGON2_OPTIONS);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET.EXPIRY_HOURS * 60 * 60 * 1000);

    // Update user with token hash
    await this.userRepo.update(user.id, {
      temporaryPassword: hashedToken,
      temporaryPasswordExpires: expiresAt,
      mustChangePassword: false, // We don't force login with temp password anymore
      temporaryPasswordUsed: false
    });

    const resetLink = `${configs.APP.WEB_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // Send email with reset link
    const emailResult = await this.emailService.send({
      to: email,
      subject: 'BuddyWallet - Password Reset Request',
      html: this.generateEmailHtml(user.name, resetLink, PASSWORD_RESET.EXPIRY_HOURS),
      text: `Hi ${user.name},\n\nYou requested a password reset. Please click the following link to reset your password:\n\n${resetLink}\n\nThis link expires in ${PASSWORD_RESET.EXPIRY_HOURS} hours and can only be used once.\n\nIf you didn't request this, please secure your account immediately.\n\nBuddyWallet Team`,
      from: 'noreply'
    });

    if (!emailResult.success) {
      log.error('PASSWORD_RESET', 'Failed to send reset email', {
        userId: user.id,
        error: emailResult.error
      });
      return { code: 'EMAIL_SEND_FAILED', error: 'Failed to send email. Please try again.' };
    }

    log.info('PASSWORD_RESET', 'Reset email sent', { userId: user.id });
    return { data: undefined };
  }

  /**
   * Complete password reset using token - set new password and clear temp fields
   */
  async resetPasswordWithToken(
    email: string,
    token: string,
    newPassword: string
  ): Promise<Result<void>> {
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

  /**
   * Obsolete completeReset method to handle force-change password, refactored to specific forceChange logic
   */
  async completeReset(userId: string, newPassword: string): Promise<Result<void>> {
    const hashedPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

    await this.userRepo.update(userId, {
      password: hashedPassword,
      temporaryPassword: null,
      temporaryPasswordExpires: null,
      temporaryPasswordUsed: false,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date()
    });

    log.info('PASSWORD_RESET', 'Password reset completed', { userId });
    return { data: undefined };
  }

  /**
   * Generate HTML email for password reset
   */
  private generateEmailHtml(name: string, resetLink: string, expiryHours: number): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">BuddyWallet</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
        You recently requested to reset your password. Click the button below to set a new password securely:
      </p>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px; text-align: center;">
        Or copy and paste this link into your browser:<br>
        <a href="${resetLink}" style="color: #2563eb; font-size: 12px; word-break: break-all;">${resetLink}</a>
      </p>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <p style="color: #92400e; font-size: 13px; margin: 0;">
          <strong>Important:</strong> This link expires in <strong>${expiryHours} hours</strong> and can only be used <strong>once</strong>.
        </p>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
        If you didn't request this, please ignore this email or secure your account.
      </p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        If you didn't request this, please secure your account by changing your password immediately.
      </p>
    </div>
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        &copy; ${new Date().getFullYear()} BuddyWallet. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
  }
}
