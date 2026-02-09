/**
 * Password Reset Service
 *
 * Handles password reset flow:
 * 1. Verify email + phone combination
 * 2. Generate temporary password
 * 3. Send via email
 * 4. Force password change on login
 */
import { users, eq, and } from '@repo/db';
import { configs } from '@/configs';
import { log } from '@utils/logger';
import { normalizePhoneNumber } from '@utils';
import type { DbClient } from '@/types';
import { emailService } from './email.service';

const TEMP_PASSWORD_LENGTH = 16;
const TEMP_PASSWORD_EXPIRY_HOURS = 24;

/**
 * Generate a secure random temporary password
 * Includes uppercase, lowercase, numbers, and special characters
 */
function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*';
  const all = uppercase + lowercase + numbers + special;

  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < TEMP_PASSWORD_LENGTH; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

interface ResetResult {
  success: boolean;
  error?: string;
}

export class PasswordResetService {
  constructor(private db: DbClient) {}

  /**
   * Request password reset
   * Verifies email + phone match, generates temp password, sends email
   */
  async requestReset(email: string, phoneNumber: string): Promise<ResetResult> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // Find user with matching email AND phone
    const user = this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.phoneNumber, normalizedPhone)))
      .get();

    if (!user) {
      // SECURITY: Don't reveal if email/phone exists - use generic message
      log.warn('PASSWORD_RESET', 'Reset attempt with non-matching credentials', { email });
      return { success: false, error: 'If the email and phone number match our records, you will receive reset instructions.' };
    }

    if (user.isLocked) {
      return { success: false, error: 'Account is locked. Please contact support.' };
    }

    // Check if there's already a valid temp password
    if (user.temporaryPassword && user.temporaryPasswordExpires) {
      const expiresAt = new Date(user.temporaryPasswordExpires);
      if (expiresAt > new Date() && !user.temporaryPasswordUsed) {
        return { success: false, error: 'A temporary password was already sent. Please check your email or wait for it to expire.' };
      }
    }

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();
    const hashedTempPassword = await Bun.password.hash(tempPassword, configs.AUTH.ARGON2_OPTIONS);
    const expiresAt = new Date(Date.now() + TEMP_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000);

    // Update user with temp password
    this.db
      .update(users)
      .set({
        temporaryPassword: hashedTempPassword,
        temporaryPasswordExpires: expiresAt,
        mustChangePassword: true,
        temporaryPasswordUsed: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))
      .run();

    // Send email with temporary password
    const emailResult = await emailService.send({
      to: email,
      subject: 'BuddyWallet - Your Temporary Password',
      html: this.generateEmailHtml(user.name, tempPassword, TEMP_PASSWORD_EXPIRY_HOURS),
      text: `Hi ${user.name},\n\nYour temporary password is: ${tempPassword}\n\nThis password expires in ${TEMP_PASSWORD_EXPIRY_HOURS} hours and can only be used once.\n\nAfter logging in, you will be required to change your password.\n\nIf you didn't request this, please secure your account immediately.\n\nBuddyWallet Team`,
      from: 'noreply'
    });

    if (!emailResult.success) {
      log.error('PASSWORD_RESET', 'Failed to send reset email', { userId: user.id, error: emailResult.error });
      return { success: false, error: 'Failed to send email. Please try again.' };
    }

    log.info('PASSWORD_RESET', 'Reset email sent', { userId: user.id });
    return { success: true };
  }

  /**
   * Verify temporary password during login
   * Returns true if temp password is valid, marks it as used
   */
  async verifyTemporaryPassword(userId: string, password: string): Promise<{ valid: boolean; mustChange?: boolean }> {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();

    if (!user || !user.temporaryPassword) {
      return { valid: false };
    }

    // Check if expired
    if (!user.temporaryPasswordExpires || new Date(user.temporaryPasswordExpires) < new Date()) {
      return { valid: false };
    }

    // Check if already used
    if (user.temporaryPasswordUsed) {
      return { valid: false };
    }

    // Verify the password
    const isValid = await Bun.password.verify(password, user.temporaryPassword);
    if (!isValid) {
      return { valid: false };
    }

    // Mark as used
    this.db
      .update(users)
      .set({
        temporaryPasswordUsed: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .run();

    log.info('PASSWORD_RESET', 'Temp password verified', { userId });
    return { valid: true, mustChange: true };
  }

  /**
   * Complete password reset - set new password and clear temp fields
   */
  async completeReset(userId: string, newPassword: string): Promise<ResetResult> {
    const hashedPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

    this.db
      .update(users)
      .set({
        password: hashedPassword,
        temporaryPassword: null,
        temporaryPasswordExpires: null,
        temporaryPasswordUsed: false,
        mustChangePassword: false,
        lastPasswordChangeAt: new Date(),
        sessionVersion: users.sessionVersion, // Will be incremented by trigger if needed
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .run();

    log.info('PASSWORD_RESET', 'Password reset completed', { userId });
    return { success: true };
  }

  /**
   * Generate HTML email for password reset
   */
  private generateEmailHtml(name: string, tempPassword: string, expiryHours: number): string {
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
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi <strong>${name}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
        You requested to reset your password. Here's your temporary password:
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <code style="font-size: 24px; font-weight: bold; color: #1f2937; letter-spacing: 2px;">${tempPassword}</code>
      </div>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <p style="color: #92400e; font-size: 13px; margin: 0;">
          <strong>Important:</strong> This password expires in <strong>${expiryHours} hours</strong> and can only be used <strong>once</strong>.
        </p>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
        After logging in, you will be required to set a new password.
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
